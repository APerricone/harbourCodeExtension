var provider = require('./provider.js');
var server = require('vscode-languageserver')
var fs = require("fs");

var connection = server.createConnection(
        new server.IPCMessageReader(process), 
        new server.IPCMessageWriter(process));

/** @type {string} */
var workspaceRoot;
var files;
connection.onInitialize(params => {
	workspaceRoot = params.rootUri;
    ParseFiles()
	return {
		capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: 2,
		}
	}
});

function ParseFiles() 
{
    files = {};
    // other scheme of uri unsupported
    if(!workspaceRoot.startsWith("file")) return;
    var path = workspaceRoot.substr(7);
	fs.readdir(path,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            if(fileName.substr(-4).toLowerCase() != ".prg") continue;
            var fileUri = workspaceRoot+"/"+encodeURI(fileName)
            var pp = new provider.Provider();
            pp.parseFile(path+"/"+fileName);
            files[fileUri] = pp;
        }
    });
}

var documents = new server.TextDocuments();
documents.listen(connection);

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
                info.kind,
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
            if(param.query.length>0 && info.name.toLowerCase().indexOf(param.query)==-1)
                continue;
            dest.push(server.SymbolInformation.create(
                info.name,
                info.kind,
                server.Range.create(info.startLine,info.startCol,info.endLine,info.endCol),
                file, info.parent));
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
