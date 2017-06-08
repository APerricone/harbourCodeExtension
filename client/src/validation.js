var vscode = require('vscode');
var cp = require("child_process");

var diagnosticCollection;

function activate(context) 
{
    diagnosticCollection = vscode.languages.createDiagnosticCollection('harbour');
	context.subscriptions.push(diagnosticCollection);

	vscode.workspace.onDidOpenTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidSaveTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidCloseTextDocument(removeValidation,undefined, context.subscriptions);
}

function deactivate()
{
	 diagnosticCollection.dispose();
}

var valRegEx = /^\r?([^\(]*)\((\d+)\)\s+(Warning|Error)\s+([^\r\n]*)/
function validate(textDocument)
{
	if(textDocument.languageId !== 'harbour' )
		return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.validating)
		return;
	var args = ["-s", "-q0", "-m", "-n0", "-w"+section.warningLevel, textDocument.fileName ];
	for (var i = 0; i < section.extraIncludePaths.length; i++) {
		var path = section.extraIncludePaths[i];
		args.push("-i"+path);
	}
	var process = cp.spawn(section.compilerExecutable,args, { cwd: vscode.workspace.path });
	process.on("error", e=>
	{
		vscode.window.showWarningMessage(`unable to start ${section.compilerExecutable}, check the "harbour.compilerExecutable" vlaue`);
	});
	var diagnostics = {};
	diagnostics[textDocument.fileName] = [];
	var errorLines = "";
	process.stderr.on('data', data => 
	{
		errorLines += data.toString();
		var p;
		while((p=errorLines.indexOf("\n"))>=0)
		{
			var subLine = errorLines.substring(0,p);
			errorLines = errorLines.substring(p+1);
			//console.error(data.toString())
			var r = valRegEx.exec(subLine);
			if(r)
			{
				var lineNr = parseInt(r[2])-1;
				var line = textDocument.lineAt(lineNr)
				if(!(r[1] in diagnostics))
				{
					diagnostics[r[1]] = [];
				}
				var subject = r[4].match(/'([^']+)'/);
				var putAll = true;
				if(subject)
				{
					var m;
					var rr = new RegExp(subject[1],"ig")
					while(m=rr.exec(line.text))
					{
						putAll = false;
						diagnostics[r[1]].push(new vscode.Diagnostic(new vscode.Range(lineNr,m.index,lineNr,m.index+subject[1].length),
							r[4], r[3]=="Warning"? 1 : 0))
					}
				} 
				if(putAll)
					diagnostics[r[1]].push(new vscode.Diagnostic(line.range,
						r[4], r[3]=="Warning"? 1 : 0))
			}
		}
	});
	process.stdout.on('data', data => 
		{} //console.log(data.toString())
	);
	process.on("exit",function(code)
	{
		for (var file in diagnostics) {
			if (diagnostics.hasOwnProperty(file)) {
				var infos = diagnostics[file];
				diagnosticCollection.set(vscode.Uri.file(file), infos);		
			}
		}
		//diagnosticCollection.set(textDocument.uri, diagnostics[textDocument.fileName]);
	});
}

function removeValidation(textDocument)
{
	diagnosticCollection.delete(textDocument.uri);
}

exports.activate = activate;
exports.deactivate = deactivate;
