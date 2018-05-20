var vscode = require('vscode');
var path = require('path');
var validation = require('./validation.js');
var decorator = require('./decorator.js');
var client = require('vscode-languageclient');
var fs = require("fs");

var diagnosticCollection;


function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*(proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?|func(?:t(?:i(?:o(?:n)?)?)?)?|class|if|else|elseif|for|if|try|case|otherwise|while|switch)\b/i,
			decreaseIndentPattern: /^\s*(end[a-z]*|next|else|elseif|next)\b/i
		}
	});
	validation.activate(context);
	decorator.activate(context);
	
	var serverModuleDbg = context.asAbsolutePath(path.join('..','server'));
	var serverModule = context.asAbsolutePath('server');
	var debugOptions = { execArgv: ["--nolazy", "--inspect=21780"] };
	var serverOptions = {
		run : { module: serverModule, transport: client.TransportKind.ipc },
		debug: { module: serverModuleDbg, transport: client.TransportKind.ipc , options: debugOptions }
	} 
	var clientOptions = {
		documentSelector: ['harbour'],
		synchronize: {
			configurationSection: 'harbour'
		}
	}
	var cl = new client.LanguageClient('HarbourServer', 'Harbour Server', serverOptions, clientOptions);
	context.subscriptions.push(cl.start());
	vscode.commands.registerCommand('harbour.getdbgcode', GetDbgCode);
}	

function GetDbgCode() {
	fs.readFile(path.resolve(__dirname, '../extra/dbg_lib.prg'),(err,data) =>
    {
        if(!err)
			vscode.workspace.openTextDocument({
				content: data.toString(), 
				language: 'harbour'}).then(doc => {
					vscode.window.showTextDocument(doc);
				})
    });
}

function deactivate() {
	 validation.deactivate();
}

exports.activate = activate;
exports.deactivate = deactivate;

