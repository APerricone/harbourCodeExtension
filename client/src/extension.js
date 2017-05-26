var vscode = require('vscode');
var client = require('vscode-languageclient');
var path = require('path');
var cp = require("child_process");

var diagnosticCollection;

function activate(context) {
	vscode.languages.setLanguageConfiguration('harbour', {
		indentationRules: {
			increaseIndentPattern: /^\s*(proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?|func(?:t(?:i(?:o(?:n)?)?)?)?|class|if|else|elseif|for|if|try|case|otherwise|while|switch)\b/i,
			decreaseIndentPattern: /^\s*(end[a-z]*|next|else|elseif|next)\b/i
		}
	});
    diagnosticCollection = vscode.languages.createDiagnosticCollection('harbour');
	vscode.workspace.onDidOpenTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidSaveTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidCloseTextDocument(removeValidation,undefined, context.subscriptions);
	context.subscriptions.push(diagnosticCollection);
	
	/*	
	let serverOptions = {
		command:  context.asAbsolutePath(path.join( 'bin', 'server'))
		//,env:{LD_LIBRARY_PATH: ":/home/perry/harbour-src/lib/linux/gcc/"}
	}
	let clientOptions = {
		documentSelector: ['harbour'],
		sincronize: {
			configurationSection: 'harbour'
		},
		fileEvents: vscode.workspace.createFileSystemWatcher('** /.clientrc')
	}
	//let disposable = new client.LanguageClient('Harbour language server', 'Harbour language server', 
	//		serverOptions, clientOptions).start();
	
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	//context.subscriptions.push(disposable);	*/
}

function deactivate() {
	 diagnosticCollection.dispose();
}

exports.activate = activate;
exports.deactivate = deactivate;

// validation
var valRegEx = /([^\(]*)\((\d+)\)\s+(Warning|Error)\s+(.*)/
function validate(textDocument)
{
	if(textDocument.languageId !== 'harbour' )
		return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.validating)
		return;
	var args = ["-s", "-q0", "-w"+section.warningLevel, textDocument.fileName ];
	for (var i = 0; i < section.extraIncludePaths.length; i++) {
		var path = section.extraIncludePaths[i];
		args.push("-i"+path);
	}
	var process = cp.spawn(section.compilerExecutable,args, { cwd: vscode.workspace.path });
	var diagnostics = [];
	process.stderr.on('data', data => 
	{
		//console.error(data.toString())
		var r = valRegEx.exec(data.toString().trim());
		if(r)
		{
			var line = parseInt(r[2])-1;
			diagnostics.push(new vscode.Diagnostic(new vscode.Range(line,0,line,Number.MAX_VALUE),
				r[4], r[3]=="Warning"? 1 : 0))
		}
	});
	process.stdout.on('data', data => 
		console.log(data.toString())
	);
	process.on("exit",function(code)
	{
		diagnosticCollection.set(textDocument.uri, diagnostics);
	});
}

function removeValidation(textDocument)
{
	diagnosticCollection.delete(textDocument.uri);
}