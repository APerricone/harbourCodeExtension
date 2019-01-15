var provider = require('./provider.js');
var server = require('vscode-languageserver')
var fs = require("fs");
var path = require("path");
var Uri = require("vscode-uri").default;

var connection = server.createConnection(
        new server.IPCMessageReader(process), 
        new server.IPCMessageWriter(process));

/** @type {Array<string>} */
var workspaceRoots;
/** @type {Array<string>} */
var includeDirs;
/** @type {Object.<string, Provider>} */
var files;
/** @type {Array} */
var docs;
/** @type {Array} */
var missing
/**
 * @typedef dbInfo
 * @property {string} dbInfo.name the name to show
 * @property {fieldInfo[]} dbInfo.fields the fields found for the database
 * 
 * @typedef fieldInfo
 * @property {string} fieldInfo.name the name to show
 * @property {string[]} fieldInfo.files the list of files where the field is found
 */
/** @type {Object.<string, dbInfo>} every key is the lowercase name of db */
var databases;
/*
    every database contiens a name (the text before the ->)
    and a list of field, objects with name (the text after the ->)
    and a files, array of string with the file where found the db.name->field.name
*/
connection.onInitialize(params => 
{
    if(params.capabilities.workspace.workspaceFolders && params.workspaceFolders) {
        workspaceRoots = [];
        for(var i=0;i<params.workspaceFolders.length;i++)
        {
            workspaceRoots.push(params.workspaceFolders[i].uri)
        }
    } else {
        workspaceRoots = [params.rootUri];
        if(!workspaceRoots[0] && params.rootPath)
        {
            if(path.sep=="\\") //window
                workspaceRoots = ["file://"+encodeURI(params.rootPath.replace(/\\/g,"/"))];
            else
                workspaceRoots = ["file://"+encodeURI(params.rootPath)];
        }
    }
    fs.readFile(path.join(__dirname, 'hbdocs.json'), "utf8",(err,data) =>
    {
        if(!err)
            docs = JSON.parse(data);
    });
    fs.readFile(path.join(__dirname, 'hbdocs.missing'), "utf8",(err,data) =>
    {
        if(!err)
            missing = data.split(/\r\n{1,2}/g)
    });
	return {
		capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(']
            },
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['>', '<', '"']
            },
			// Tell the client that the server works in FULL text document sync mode
            textDocumentSync: 1,
            workspace: {
                supported: true
            }
        }
	}
});
/*
connection.workspace.onDidChangeWorkspaceFolders(params=>{
    var i=0;
})
*/
connection.onDidChangeConfiguration(params=>{
    var searchExclude = params.settings.search.exclude;
    // minimatch
    includeDirs = params.settings.harbour.extraIncludePaths;
    ParseWorkspace();

})

function ParseDir(dir, onlyHeader)
{
	fs.readdir(dir,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            var ext = path.extname(fileName).toLowerCase();
            if (onlyHeader &&  ext!=".ch" && ext!=".h")
            {
                continue;
            }
            var cMode = (ext.startsWith(".c") && ext!=".ch") || ext == ".h"
            if(	ext == ".prg" || ext == ".ch" || cMode )
            {
                var fileUri = Uri.file(path.join(dir,fileName));
                var pp = new provider.Provider();
                pp.parseFile(path.join(dir,fileName),fileUri.toString(), cMode).then(
                    prov => {
                        UpdateFile(prov)
                    }
                )
            }
        }
    });
}

function ParseWorkspace() 
{
    databases = {};
    files = {};
    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") return;
        ParseDir(uri.fsPath);
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        //var uri = Uri.parse(includeDirs[i]);
        //if(uri.scheme != "file") return;        
        ParseDir(includeDirs[i], true);
    }
}

var documents = new server.TextDocuments();
documents.listen(connection);
documents.onDidSave((e)=>
{
    var uri = Uri.parse(e.document.uri);
    if(uri.scheme != "file") return;
    var found = false;
    for(var i=0;i<workspaceRoots.length;i++)
        if(e.document.uri.startsWith(workspaceRoots[i]))
            found = true;
    if(!found) return; //not include file outside the current workspace
    var ext = path.extname(uri.fsPath).toLowerCase();
    var cMode = (ext.startsWith(".c") && ext!=".ch")
    if(	ext == ".prg" || ext == ".ch" || cMode )
    {
        var pp = parseDocument(e.document, cMode)
        UpdateFile(pp);
    }
})

/**
 * Update a file in the workspace
 * @param {provider.Provider} pp 
 */
function UpdateFile(pp)
{
    var doc = pp.currentDocument;
    if(doc in files)
        for(var db in databases)
        {
            for(var f in databases[db].fields)
            {
                var idx = databases[db].fields[f].files.indexOf(doc);
                if(idx>0)
                {
                    databases[db].fields[f].files.splice(idx,1);
                    if(databases[db].fields[f].files.length==0)
                    {
                        delete databases[db].fields[f];
                    }
                }
            }
            if(Object.keys(databases[db].fields).length==0)
            {
                delete databases[db];
            }
        }
    files[doc] = pp;
    for(var db in pp.databases)
    {
        var ppdb = pp.databases[db];
        if(!(db in databases)) databases[db]={name:ppdb.name, fields: {}};
        var gbdb = databases[db];
        for(var f in ppdb.fields)
        {
            if(!(f in gbdb.fields))
                gbdb.fields[f]={name: ppdb.fields[f], files: [doc]}; 
            else
                gbdb.fields[f].files.push(doc);
        }
    }
}

function kindTOVS(kind,sk)
{
    if(sk==undefined) sk=true;
    switch(kind)
    {
        case "class":
            return sk? server.SymbolKind.Class : server.CompletionItemKind.Class;
        case "method":
            return sk? server.SymbolKind.Method : server.CompletionItemKind.Method;
        case "data":
            return sk? server.SymbolKind.Property : server.CompletionItemKind.Property;
        case "function":
        case "procedure":
        case "function*":
        case "procedure*":
        case "C-FUNC":
            return sk? server.SymbolKind.Function : server.CompletionItemKind.Function;
        case "local":
        case "static":
        case "public":
        case "private":
        case "param":
        case "memvar":
            return sk? server.SymbolKind.Variable : server.CompletionItemKind.Variable;
        case "field":
            return sk? server.SymbolKind.Field : server.CompletionItemKind.Field;
    }
    return 0;
}

connection.onDocumentSymbol((param)=>
{
    var p = parseDocument(documents.get(param.textDocument.uri));
    var dest = [];
    for (var fn in p.funcList) {
        //if (p.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = p.funcList[fn];
            dest.push(server.SymbolInformation.create(
                info.name,
                kindTOVS(info.kind),
                server.Range.create(info.startLine,info.startCol,
                                    info.endLine,info.endCol),
                param.textDocument.uri, info.parent?info.parent.name:"")
            );
        //}        
    };
    return dest;
});

connection.onWorkspaceSymbol((param)=>
{
    var dest = [];
    var src = param.query.toLowerCase();
    var parent = undefined;
    var colon = src.indexOf(':');
    if(colon>0)
    {
        parent = src.substring(0,colon);
        src = src.substr(colon+1);
    }
    for (var file in files) { //if (files.hasOwnProperty(file)) {
        var pp = files[file];
        for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if( info.kind!="class" && 
                info.kind!="method" && 
                !info.kind.startsWith("procedure") && 
                !info.kind.startsWith("function"))
                continue;
            // workspace symbols takes statics too
            if(param.query.length>0 && 
            	info.nameCmp.indexOf(src)==-1)
                continue;
            if(parent && (!info.parent || info.parent.nameCmp!=parent))
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
    var line = doc.getText(server.Range.create(params.position.line,0,params.position.line,100));
    var include = /^\s*#include\s+[<"]([^>"]*)/.exec(line);
    if(include!==null)
    {
        var startPath = undefined;
        if(params.textDocument.uri && params.textDocument.uri.startsWith("file"))
        {
            startPath = path.dirname(Uri.parse(params.textDocument.uri).fsPath);
        }
        return definitionFiles(include[1],startPath);
    }
    /** @type {string} */
    var pos = doc.offsetAt(params.position);
    var delta = 20;
    var word;
    //var allText = doc.getText();
    var r = /\b[a-z_][a-z0-9_]*\b/gi
    while(true)
    {
        r.lastIndex = 0;
        //var text = allText.substr(Math.max(pos-delta,0),delta+delta)
        var text = doc.getText(server.Range.create(doc.positionAt(Math.max(pos-delta,0)),doc.positionAt(pos+delta)));
        var txtPos = pos<delta? pos : delta;
        while(word = r.exec(text))
        {
            if(word.index<=txtPos && word.index+word[0].length>=txtPos)
                break;
        }
        if(!word) return [];
        if(word.index!=0 && (word.index+word[0].length)!=(delta+delta)) break;
        delta+=10;
    }
    word=word[0].toLowerCase();
    var dest = [];
    var thisDone = false;
    for (var file in files) { //if (files.hasOwnProperty(file)) {
            if(file==doc.uri)
            {
                var pp = parseDocument(doc);
                UpdateFile(pp)
                thisDone = true;
            }
            var pp = files[file];
            for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if(info.nameCmp != word)
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
    if(!thisDone)
    {
        var p = parseDocument(doc);
        for (var fn in p.funcList) {
            //if (p.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = p.funcList[fn];
            if(info.nameCmp != word) continue;
            if(info.kind=='local' || info.kind=='param')
            {
                var parent = info.parent;
                if(parent)
                {
                    if(parent.startLine>params.position.line)
                        continue;
                    if(parent.endLine<params.position.line)
                        continue;
                }            
            }
            dest.push(server.Location.create(doc.uri,
                server.Range.create(info.startLine,info.startCol,
                                info.endLine,info.endCol)));
            }        
        //};    
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
    var thisDone = false;
    for (var file in files) //if (files.hasOwnProperty(file)) 
    {
        if(file==doc.uri)
        {
            var pp=parseDocument(doc);
            UpdateFile(pp)
            thisDone = true;
        }
        var pp = files[file];
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if(info.nameCmp != word)
                continue;
            if(info.kind.endsWith("*") && file!=doc.uri)
                continue;
            var s = {}
            if (info.kind.startsWith("method"))
                if(info.parent)
                {
                    s["label"] = info.parent.name+":"+info.name;
                    if(className && className!=info.parent.nameCmp)
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
            if(subParams.length>=nC)
                signatures.push(s);
        }
    }
    if(!thisDone)
    {
        var pp = parseDocument(doc);
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if(info.nameCmp != word)
                continue;
            var s = {}                
            if (info.kind.startsWith("method"))
                if(info.parent)
                {
                    s["label"] = info.parent.name+":"+info.name;
                    if(className && className!=info.parent.nameCmp)
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

/**
 * 
 * @param {server.TextDocument} doc 
 * @param {boolean} cMode
 */
function parseDocument(doc,cMode)
{
    var pp = new provider.Provider
    pp.Clear();
    pp.currentDocument=doc.uri;
	if(cMode != undefined)
        pp.cMode = cMode;
	for (var i = 0; i < doc.lineCount; i++) {
		pp.parse(doc.getText(server.Range.create(i,0,i,1000)));
	}
	pp.endParse();
    return pp;
}

connection.onCompletion((param)=> 
{
    var doc = documents.get(param.textDocument.uri);
    var line = doc.getText(server.Range.create(param.position.line,0,param.position.line,100));
    var include = line.match(/^\s*#include\s+[<"]([^>"]*)/);
    if(include!==null)
    {
        var startPath = undefined;
        if(param.textDocument.uri && param.textDocument.uri.startsWith("file"))
        {
            startPath = path.dirname(Uri.parse(param.textDocument.uri).fsPath)
        }
        return completitionFiles(include[1], startPath);
    }
    var allText = doc.getText();
    var completitions = [];
    var pos = doc.offsetAt(param.position)-1
    // Get the word
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    var pp = parseDocument(doc);
    if(doc.uri in files)
    {
        UpdateFile(pp)
        pp=undefined;
    }
    while(pos>=0 && rge.test(allText[pos]))
    {
        word = allText[pos]+word;
        pos--;
    }
    word = word.toLowerCase();
    var precLetter = allText[pos];
    if(precLetter == '>' && allText[pos-1]=='-')
    {
        completitions = CompletitionDBFields(word, allText,pos, pp)        
    }
    if(word.length==0) return server.CompletionList.create(completitions,true);
    for(var dbName in databases)
        if(dbName.startsWith(word))
        {
            var c = server.CompletionItem.create(databases[dbName].name);
            c.kind = server.CompletionItemKind.Struct
            c.sortText = "AAAA" + databases[dbName].name
            completitions.push(c);   
        }
    if(pp)
    {
        for(var dbName in pp.databases)
            if(dbName.startsWith(word))
            {
                var c = server.CompletionItem.create(pp.databases[dbName].name);
                c.kind = server.CompletionItemKind.Struct
                c.sortText = "AAAA" + pp.databases[dbName].name
                completitions.push(c);   
        }
    }
    function GetCompletitions(pp,file)
    {
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            var info = pp.funcList[iSign];
            if(info.nameCmp.substr(0,word.length) != word)
                continue;
            if(precLetter == '->' && info.kind != "field")
                continue;
            if((info.kind == "method" || info.kind == "data") && (precLetter!=':'))
                continue;
            if(info.kind == "function*" || info.kind=="procedure*" || info.kind=="static")
            {
                if(info.kind.endsWith("*") && file!=doc.uri)
                    continue;
            }
            //if(info.kind == "local" || info.kind == "param")
            if(info.parent && ( info.parent.kind.startsWith("function")  || info.parent.kind.startsWith("procedure") || info.parent.kind=='method'))
            {
                if(file!=doc.uri) continue;
                if(param.position.line<info.parent.startLine || 
                    param.position.line>info.parent.endLine)
                        continue;
            }
            if(completitions.find(v=> v.name == info.name))
                continue;
            var c = server.CompletionItem.create(info.name);
            c.kind = kindTOVS(info.kind,false);
            c.sortText = "AAA"+info.nameCmp
            completitions.push(c);   
        }
    }
    for (var file in files) // if (files.hasOwnProperty(file)) it is unnecessary
    {
        GetCompletitions(files[file],file);
    }
    if(pp)
    {
        GetCompletitions(pp,doc.uri);
    }
    if(precLetter!=':' && precLetter!='->')
    {
        for (var i = 0; i < docs.length; i++)
        {
            if (docs[i].name.toLowerCase().substr(0,word.length) == word)
            {
                var c = server.CompletionItem.create(docs[i].name+"(");
                c.kind = server.CompletionItemKind.Function;
                c.documentation = docs[i].documentation;
                c.sortText = "AA"+docs[i].name
                completitions.push(c);
            }
        }
        for (var i = 1; i < missing.length; i++)
        {
            if(missing[i].toLowerCase().substr(0,word.length) == word)
            {
                var c = server.CompletionItem.create(missing[i]);
                c.kind = server.CompletionItemKind.Function;
                c.sortText = "A"+missing[i]
                completitions.push(c);
            }
        }
    }
    return server.CompletionList.create(completitions,true);    
})

function completitionFiles(word, startPath)
{
    var completitons = [];
    word = word.replace("\r","").replace("\n","").toLowerCase()
    var startDone = false;

    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") continue;
        if(startPath && uri.fsPath.toLowerCase()==startPath.toLowerCase()) startDone=true;
        var ff = fs.readdirSync(uri.fsPath)
        for(var fi=0;fi<ff.length;fi++)
        {
            var ext = path.extname(ff[fi]).toLowerCase();
            if(ext!=".h" && ext!=".ch")
                continue;
            if(word.length != 0 && ff[fi].substr(0,word.length).toLowerCase()!=word)
                continue;
            var c = server.CompletionItem.create(ff[fi]);
            c.kind = server.CompletionItemKind.File;
            completitons.push(c);
        }
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        if(startPath && includeDirs[i].toLowerCase()==startPath.toLowerCase()) startDone=true;
        var ff = fs.readdirSync(includeDirs[i]);
        for(var fi=0;fi<ff.length;fi++)
        {
            var ext = path.extname(ff[fi]).toLowerCase();
            if(ext!=".h" && ext!=".ch")
                continue;
            if(word.length != 0 && ff[fi].substr(0,word.length).toLowerCase()!=word)
                continue;
            var c = server.CompletionItem.create(ff[fi]);
            c.kind = server.CompletionItemKind.File;
            completitons.push(c);
        }
    }
    if(startPath && !startDone)
    {
        var ff = fs.readdirSync(startPath);
        for(var i=0;i<ff.length;i++)
        {
            var ext = path.extname(ff[i]).toLowerCase();
            if(ext!=".h" && ext!=".ch")
                continue;
            if(word.length != 0 && ff[i].substr(0,word.length).toLowerCase()!=word)
                continue;
            var c = server.CompletionItem.create(ff[i]);
            c.kind = server.CompletionItemKind.File;
            completitons.push(c);
        }
    }
    return server.CompletionList.create(completitons,true);
}

function definitionFiles(fileName, startPath)
{
    var dest = [];
    fileName = fileName.toLowerCase();
    var startDone = false;
    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") continue;
        if(startPath && uri.fsPath.toLowerCase()==startPath.toLowerCase()) startDone=true;
        var ff = fs.readdirSync(uri.fsPath)
        for(var fi=0;fi<ff.length;fi++)
        {
            if(ff[fi].toLowerCase() == fileName)
            {
                var fileUri = Uri.file(path.join(uri.fsPath,ff[fi])).toString();
                dest.push(server.Location.create(fileUri, server.Range.create(0,0,0,0)));
            }
        }
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        if(startPath && includeDirs[i].toLowerCase()==startPath.toLowerCase()) startDone=true;
        var ff = fs.readdirSync(includeDirs[i]);
        for(var fi=0;fi<ff.length;fi++)
        {
            if(ff[fi].toLowerCase() == fileName)
            {
                var fileUri =  Uri.file(path.join(includeDirs[i],ff[fi])).toString();
                dest.push(server.Location.create(fileUri, server.Range.create(0,0,0,0)));
            }
        }
    }
    if(startPath && !startDone)
    {
        var ff = fs.readdirSync(startPath);
        for(var fi=0;fi<ff.length;fi++)
        {
            if(ff[fi].toLowerCase() == fileName)
            {
                var fileUri =  Uri.file(path.join(startPath,ff[fi])).toString();
                dest.push(server.Location.create(fileUri, server.Range.create(0,0,0,0)));
            }
        }
    }
    return dest;
}


function CompletitionDBFields(word, allText,pos, pp)
{
    //precLetter = '->';
    var pdb = pos-2;
    var dbName = "";
    var nBracket = 0;
    while((allText[pdb]!=' ' && allText[pdb]!='\t') || nBracket>0)
    {
        var c = allText[pdb];
        pdb--;
        if(c==')') nBracket++;
        if(c=='(') nBracket--;
        dbName = c+dbName;
    }
    var completitions = [];
    dbName = dbName.toLowerCase();
    if(dbName in databases) {
        var db = databases[dbName];
        for(var f in db.fields)
        {
            if(word.length==0 || (f.startsWith(word) && f!=word))
            {
                var c = server.CompletionItem.create(db.fields[f].name);
                c.kind = server.CompletionItemKind.Field;
                c.documentation = db.name;
                c.sortText = "AAAA" + db.fields[f].name
                completitions.push(c);
            }
        }
    }
    if(pp && dbName in pp.databases)
    {
        var db = pp.databases[dbName];
        for(var f in db.fields)
        {
            if(word.length==0 || (f.startsWith(word) && f!=word))
            {
                var c = server.CompletionItem.create(db.fields[f]);
                c.kind = server.CompletionItemKind.Field;
                c.documentation = db.name;
                c.sortText = "AAAA" + db.fields[f]
                completitions.push(c);
            }
        }
    }
    return completitions;
}


/*
connection.onDidChangeTextDocument(params => {
    var p = new provider.Provider();
    p.parseString(params.document.getText());
    
});
*/
connection.listen();