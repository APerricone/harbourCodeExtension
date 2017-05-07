var vscode = require('vscode');
var client = require('vscode-languageclient');
var path = require('path');

function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*(proc[a-z]*|func[a-z]*|class|if|else|elseif|for|if|try|case|otherwise|while|switch)\b/i,
			decreaseIndentPattern: /^\s*(end[a-z]*|next|else|elseif|next)\b/i
		}
	});
	let serverOptions = {
		command:  context.asAbsolutePath(path.join( 'bin', 'server'))
		//,env:{LD_LIBRARY_PATH: ":/home/perry/harbour-src/lib/linux/gcc/"}
	}
	let clientOptions = {
		documentSelector: ['harbour'],
		sincronize: {
			configurationSection: 'harbourCompiler'
		}
	}
	let disposable = new client.LanguageClient('Harbour language server', 'Harbour language server', 
			serverOptions, clientOptions).start();
	
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);	
}

function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;
