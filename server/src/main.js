var provider = require('./provider.js');
var server = require('vscode-languageserver')
var fs = require("fs");
var path = require("path");

var connection = server.createConnection(
        new server.IPCMessageReader(process), 
        new server.IPCMessageWriter(process));

/** @type {string} */
var workspaceRoot;
var files;
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
    ParseFiles()
	return {
		capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: 1,
		}
	}
});

function ParseFiles() 
{
    files = {};
    // other scheme of uri unsupported
    if(!workspaceRoot.startsWith("file")) return;
    var workspacePath = workspaceRoot.substr(7);
    if(path.sep == "\\")
        workspacePath = workspaceRoot.substr(8).replace("%3A",":")
	fs.readdir(workspacePath,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            if(fileName.substr(-4).toLowerCase() != ".prg") continue;
            var fileUri = workspaceRoot+"/"+encodeURI(fileName)
            var pp = new provider.Provider();
            pp.parseFile(workspacePath+"/"+fileName);
            files[fileUri] = pp;
        }
    });
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
                param.textDocument.uri, info.parent)
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
                file, info.parent));
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
    var r = /\b[a-z][a-z0-9]*\b/gi
    while(word = r.exec(text))
    {
        if(word.index<=pos && word.index+word[0].length>pos)
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
            if(info.kind=='local')
            {
                if(file!=doc.uri)
                    continue;
                var parent = pp.funcList.find(v=> v.name = info.parent);
                if(parent.startLine>params.position.line)
                    continue;
                if(parent.endLine<params.position.line)
                    continue;
            }
            dest.push(server.Location.create(file,
                server.Range.create(info.startLine,info.startCol,
                                    info.endLine,info.endCol)));
        }
    }
    return dest;
})
/*
connection.onDidChangeTextDocument(params => {
    var p = new provider.Provider();
    p.parseString(params.document.getText());
    
});
*/
connection.listen();
