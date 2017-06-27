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
                server.Range.create(info.startLine,info.startCol,info.endLine,info.endCol),
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
            if(param.query.length>0 && info.name.toLowerCase().indexOf(src)==-1)
                continue;
            dest.push(server.SymbolInformation.create(
                info.name,
                kindTOVS(info.kind),
                server.Range.create(info.startLine,info.startCol,info.endLine,info.endCol),
                file, info.parent));
            if(dest.length>100)
                return [];
        }
    }
    return dest;
});
/*
connection.onDidChangeTextDocument(params => {
    var p = new provider.Provider();
    p.parseString(params.document.getText());
    
});
*/
connection.listen();
