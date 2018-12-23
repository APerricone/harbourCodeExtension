var provider = require('./provider.js');
var server = require('vscode-languageserver')
var fs = require("fs");
var path = require("path");
var Uri = require("vscode-uri").default;

var connection = server.createConnection(
        new server.IPCMessageReader(process), 
        new server.IPCMessageWriter(process));

/** @type {string} */
var workspaceRoot;
var files;
/** @type {Array} */
var docs;
connection.onInitialize(params => 
{
    workspaceRoot = params.rootUri;
    if(!workspaceRoot)
    {
        if(path.sep=="\\") //window
            workspaceRoot = "file://"+encodeURI(params.rootPath.replace(/\\/g,"/"));
        else
            workspaceRoot = "file://"+encodeURI(params.rootPath);
    }
    fs.readFile(path.resolve(__dirname, 'hbdocs.json'),(err,data) =>
    {
        if(!err)
            docs = JSON.parse(data);
    });
    ParseFiles()
	return {
		capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(']
            },
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: 1,
		}
	}
});

connection.onDidChangeConfiguration(params=>{
    var i=0;
    var searchExclude = params.settings.search.exclude;
    // minimatch
    var extraInclude = params.settings.harbour.extrasourcePaths;
})


function ParseDir(dir)
{
	fs.readdir(dir,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
			var ext = path.extname(fileName).toLowerCase();
			if(	ext == ".prg" || ext == ".c" )
            {
                var fileUri = Uri.file(dir+"/"+fileName)
                var pp = new provider.Provider();
                pp.parseFile(dir+"/"+fileName,ext == ".c");
                files[fileUri.toString()] = pp;    
            }/* else
            if(fileName.indexOf(".")<0)
            {
                checkDir(dir+"/"+fileName)
            }*/
        }
    });
}

function checkDir(dir)
{
    fs.stat(dir, function(err, stat)
    {
        if (stat && stat.isDirectory())
        {
          ParseDir(dir)
        }
    });

}

function ParseFiles() 
{
    files = {};
    // other scheme of uri unsupported
    /** @type {vscode-uri.default} */
    var uri = Uri.parse(workspaceRoot);
    if(uri.scheme != "file") return;
    ParseDir(uri.fsPath);
}

var documents = new server.TextDocuments();
documents.listen(connection);
documents.onDidSave((e)=>
{
    var uri = Uri.parse(e.document.uri);
    if(uri.scheme != "file") return;
    var ext = path.extname(uri.fsPath).toLowerCase();
    if(	ext == ".prg" || ext == ".c" )
    {
        var pp = new provider.Provider();
        files[e.document.uri] = pp;
        pp.parseString(e.document.getText(),ext == ".c");
    }
})

function kindTOVS(kind)
{
    switch(kind)
    {
        case "class":
            return server.SymbolKind.Class;
        case "method":
            return server.SymbolKind.Method;
        case "data":
            return server.SymbolKind.Property;
        case "function":
        case "procedure":
        case "function*":
        case "procedure*":
        case "C-FUNC":
            return server.SymbolKind.Function;
        case "local":
        case "static":
        case "public":
        case "private":
        case "param":
            return server.SymbolKind.Variable;
    }
    return kind;
}

connection.onDocumentSymbol((param)=>
{
    var p = new provider.Provider
    p.parseString(documents.get(param.textDocument.uri).getText());
    var dest = [];
    for (var fn in p.funcList) {
        if (p.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = p.funcList[fn];
            dest.push(server.SymbolInformation.create(
                info.name,
                kindTOVS(info.kind),
                server.Range.create(info.startLine,info.startCol,
                                    info.endLine,info.endCol),
                param.textDocument.uri, info.parent?info.parent.name:"")
            );
        }        
    };
    return dest;
});

connection.onWorkspaceSymbol((param)=>
{
    var dest = [];
    var src = param.query.toLowerCase();
    for (var file in files) if (files.hasOwnProperty(file)) {
        var pp = files[file];
        for (var fn in pp.funcList) if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if( info.kind!="class" && 
                info.kind!="method" && 
                info.kind!="procedure" && 
                info.kind!="function")
                continue;
            if(param.query.length>0 && 
            	info.name.toLowerCase().indexOf(src)==-1)
                continue;
            dest.push(server.SymbolInformation.create(
                info.name,
                kindTOVS(info.kind),
                server.Range.create(info.startLine,info.startCol,
                                    info.endLine,info.endCol),
                file, info.parent?info.parent.name:""));
            if(dest.length>100)
                return [];
        }
    }
    return dest;
});

connection.onDefinition((params)=>
{
    var doc = documents.get(params.textDocument.uri);
    /** @type {string} */
    var pos = doc.offsetAt(params.position);
    var text = doc.getText().substr(Math.max(pos-20,0),40);
    var pos = pos<20? pos : 20;
    var word;
    var r = /\b[a-z_][a-z0-9_]*\b/gi
    while(word = r.exec(text))
    {
        if(word.index<=pos && word.index+word[0].length>=pos)
            break;
    }
    if(!word) return [];
    word=word[0].toLowerCase();
    var dest = [];
    for (var file in files) if (files.hasOwnProperty(file)) {
        var pp = files[file];
        for (var fn in pp.funcList) if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if(info.name.toLowerCase() != word)
                continue;
            if(info.kind.endsWith("*") && file!=doc.uri)
                continue;
            if(info.kind=='local' || info.kind=='param')
            {
                if(file!=doc.uri)
                    continue;
                var parent = info.parent;
                if(parent)
                {
                    if(parent.startLine>params.position.line)
                        continue;
                    if(parent.endLine<params.position.line)
                        continue;
                }            
            }
            dest.push(server.Location.create(file,
                server.Range.create(info.startLine,info.startCol,
                                info.endLine,info.endCol)));
        }
    }
    return dest;
})

connection.onSignatureHelp((params)=>
{
    var doc = documents.get(params.textDocument.uri);
    var pos = doc.offsetAt(params.position)-1;
    /** @type {string} */
    var text = doc.getText();
    // backwards find (
    pos=findBracket(text,pos,-1,"(")
    if(pos===undefined) return pos;
    // Get parameter position
    var endPos=doc.offsetAt(params.position)
    var nC = CountParameter(text.substr(pos+1,endPos-pos-1), doc.offsetAt(params.position)-pos-1)
    // Get the word
    pos--;
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    while(rge.test(text[pos]))
    {
        word = text[pos]+word;
        pos--;
    }
    word=word.toLowerCase();
    // special case for new, search the class name
    if(word=="new")
    {
        var prec = text.substring(pos-2,pos+1);
        if(prec = "():")
        {
            pos-=3;
            className="";
            while(rge.test(text[pos]))
            {
                className = text[pos]+className;
                pos--;
            }
            className = className.toLowerCase();
        }
    }
    var signatures = [].concat(getStdHelp(word, nC));
    signatures = signatures.concat(getWorkspaceSignatures(word, doc, className, nC));
    return {signatures:signatures, activeParameter:nC}
})

/**
 * 
 * @param {String} text
 * @param {Number} pos 
 * @param {Number} dir 
 * @param {String} bracket 
 */
function findBracket(text,pos,dir,bracket)
{
    var nP = 0, str
    while(nP!=0 || text[pos]!=bracket || str!=undefined )
    {
        if(pos<0) return undefined;
        if(pos>=text.length) return undefined;
        if(str)
        {
            if(text[pos]==str)
                str=undefined;
        } else
        {
            switch (text[pos]) {
                case '(': nP--; break;
                case ')': nP++; break;
                case '[': if(dir>0) str=']'; break
                case ']': if(dir<0) str='['; break
                case '{': if(dir>0) str='}'; break
                case '}': if(dir<0) str='{'; break
                case '"': str='"'; break
                case "'": str="'"; break
                case '\n': 
                    var nSpace = 1;
                    while(text[pos-nSpace]!='\n') nSpace++;                    
                    var thisLine = text.substr(pos-nSpace+1,nSpace)
                    thisLine=thisLine.replace( /\/\/[^\n]*\n/,"\n")
                    thisLine=thisLine.replace( /&&[^\n]*\n/,"\n")
                    thisLine=thisLine.replace( /\s+\n/,"\n")
                    if (thisLine[thisLine.length-2]==';')
                        break;
                    return undefined;
                    break;
            }
        }
        pos+=dir;
    }        
    return pos
}

/**
 * 
 * @param {String} txt The text where count the parameter
 * @param {Number} position Position of cursor
 */
function CountParameter(txt, position)
{
    var  i=0;
	while(true)
	{
		i++;
		var filter=undefined;
		switch(i)
		{
			case 1: filter = /;\s*\r?\n/g; break;  // new line with ;
			case 2: filter = /'[^']*'/g; break; // ' strings
			case 3: filter = /"[^"]*"/g; break; // " strings
			case 4: filter = /\[[^\[\]]*\]/g; break; // [] strings or array index
			case 5: filter = /{[^{}]*}/g; break; // {} array
			case 6: filter = /\([^\(\)]*\)/g; break; // couple of parenthesis
		}
		if (filter == undefined)
			break;
		do
		{
            var someChange = false
            txt=txt.replace(filter,function(matchString)
            {
                someChange = true;
                return Array(matchString.length+1).join("X");
            })
		} while(someChange)
    }
    return (txt.substr(0,position).match(/,/g) || []).length
}

function getWorkspaceSignatures(word, doc, className, nC)
{
    var signatures = [];
    for (var file in files) if (files.hasOwnProperty(file)) 
    {
        var pp = files[file];
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if(info.name.toLowerCase() != word)
                continue;
            if(info.kind.endsWith("*") && file!=doc.uri)
                continue;
            var s = {}
            if (info.kind.startsWith("method"))
                if(info.parent)
                {
                    s["label"] = info.parent.name+":"+info.name;
                    if(className && className!=info.parent.name.toLowerCase())
                        continue;
                }
                else
                {
                    s["label"] = "??:"+info.name;
                    if(className)
                        continue;
                }
            else
                s["label"] = info.name;
            s["label"] += "("
            var subParams = [];
            for (var iParam=iSign+1;iParam<pp.funcList.length;iParam++)
            {
                /** @type {provider.Info} */
                var subinfo = pp.funcList[iParam];
                if(subinfo.parent==info && subinfo.kind=="param")
                {
                    subParams.push({"label":subinfo.name})
                    if(!s.label.endsWith("("))
                        s.label += ", "
                    s.label+=subinfo.name
                } else
                    break;
            }
            s["label"] += ")"
            s["parameters"]=subParams;
            if(info.comment && info.comment.trim().length>0)
                s["documentation"]=info.comment 
            if(subParams.length>nC)
                signatures.push(s);
        }
    }
    return signatures;
}

function getStdHelp(word, nC)
{
    var signatures = [];
    for (var i = 0; i < docs.length; i++)
    {
        if (docs[i].name.toLowerCase() == word)
        {
            var s = {};
            s["label"] = docs[i].label;
            s["documentation"] = docs[i].documentation;
            var subParams = [];
            for (var iParam = 0; iParam < docs[i].arguments.length; iParam++)
            {
                subParams.push({
                    "label": docs[i].arguments[iParam].label,
                    "documentation": docs[i].arguments[iParam].documentation
                });
            }
            s["parameters"] = subParams;
            signatures.push(s);
        }
    }
    return signatures;
}


/*
connection.onDidChangeTextDocument(params => {
    var p = new provider.Provider();
    p.parseString(params.document.getText());
    
});
*/
connection.listen();