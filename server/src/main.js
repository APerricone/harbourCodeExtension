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

function ParseDir(dir)
{
	fs.readdir(dir,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            if(fileName.substr(-4).toLowerCase() == ".prg")
            {
                var fileUri = Uri.file(dir+"/"+fileName)
                var pp = new provider.Provider();
                pp.parseFile(dir+"/"+fileName);
                files[fileUri.toString()] = pp;    
            } else
            if(fileName.indexOf(".")<0)
            {
                checkDir(dir+"/"+fileName)
            }
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
    var pp = new provider.Provider();
    files[e.document.uri] = pp;
    pp.parseString(e.document.getText());
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
    var nP = 0;
    var nC = 0;
    while(nP!=0 || text[pos]!='(')
    {
        switch (text[pos]) {
            case '(': nP--; break;
            case ')': nP++; break;
            case ',': if(nP==0) nC++; break;
            case '\n': 
                if ((text[pos-1]=='\r' && text[pos-2]==';') || text[pos-1]==';')
                    break;
                return undefined;
                break;
        }
        pos--;
    }
    pos--;
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    while(rge.test(text[pos]))
    {
        word = text[pos]+word;
        pos--;
    }
    word=word.toLowerCase();
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
    signatures = signatures.concat(getWorkspaceSignatures(word, className, nC));
    return {signatures:signatures, activeParameter:nC}
})

function getWorkspaceSignatures(word, className, nC)
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
            if (subParams.length > nC)
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