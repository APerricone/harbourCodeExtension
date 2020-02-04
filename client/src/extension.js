const vscode = require('vscode');
const path = require('path');
const client = require('vscode-languageclient');
const fs = require("fs");
const validation = require('./validation.js');
const decorator = require('./decorator.js');
const docCreator = require('./docCreator.js');
const taskProvider = require('./taskProvider.js');

var diagnosticCollection;


function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*((?:(?:static|init|exit)\s+)?(?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?|func(?:t(?:i(?:o(?:n)?)?)?)?)|class|method|if|else(?:if)?|for|if|try|case|otherwise|(?:do\s+)?while|switch|begin)\b/i,
			decreaseIndentPattern: /^\s*(end\s*([a-z]*)?|next|else|elseif|return)\b/i
		}
	});
	validation.activate(context);
	
	var serverModuleDbg = context.asAbsolutePath(path.join('..','server'));
	var serverModule = context.asAbsolutePath('server');
	var debugOptions = { execArgv: ["--nolazy", "--inspect-brk=21780"] };
	var serverOptions = {
		run : { module: serverModule, transport: client.TransportKind.ipc },
		debug: { module: serverModuleDbg, transport: client.TransportKind.ipc , options: debugOptions }
	} 
	var clientOptions = {
		documentSelector: ['harbour'],
		synchronize: {
			configurationSection: ['harbour','search','editor']
		}
	}
	var cl = new client.LanguageClient('HarbourServer', 'Harbour Server', serverOptions, clientOptions);
	context.subscriptions.push(cl.start());
	vscode.commands.registerCommand('harbour.getdbgcode', GetDbgCode);
	//vscode.languages.registerFoldingRangeProvider(['harbour'], new decorator.HBProvider());
	decorator.activate(context,cl);
	docCreator.activate(context,cl);
	taskProvider.activate();
}	

function GetDbgCode() {
	fs.readFile(path.resolve(__dirname, path.join('..','extra','dbg_lib.prg')),(err,data) =>
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

