var vscode = require('vscode');
var client = require('vscode-languageclient');
var path = require('path');
var validation = require('./validation.js');

var diagnosticCollection;

function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*(proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?|func(?:t(?:i(?:o(?:n)?)?)?)?|class|if|else|elseif|for|if|try|case|otherwise|while|switch)\b/i,
			decreaseIndentPattern: /^\s*(end[a-z]*|next|else|elseif|next)\b/i
		}
	});
	validation.activate(context);
	vscode.workspace.onDidOpenTextDocument(validation.validate,undefined, context.subscriptions);
	vscode.workspace.onDidSaveTextDocument(validation.validate,undefined, context.subscriptions);
	vscode.workspace.onDidCloseTextDocument(validation.removeValidation,undefined, context.subscriptions);
}

function deactivate() {
	 validation.deactivate();
}

exports.activate = activate;
exports.deactivate = deactivate;

