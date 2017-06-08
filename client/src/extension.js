var vscode = require('vscode');
var path = require('path');
var validation = require('./validation.js');
var provider = require('./provider.js');
//var decorator = require('./decorator.js');

var diagnosticCollection;


function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*(proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?|func(?:t(?:i(?:o(?:n)?)?)?)?|class|if|else|elseif|for|if|try|case|otherwise|while|switch)\b/i,
			decreaseIndentPattern: /^\s*(end[a-z]*|next|else|elseif|next)\b/i
		}
	});
	validation.activate(context);
	//decorator.activate(context);

	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(
		{ "language": 'harbour'},
		new provider.Provider()));
}

function deactivate() {
	 validation.deactivate();
}

exports.activate = activate;
exports.deactivate = deactivate;

