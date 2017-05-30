var vscode = require('vscode');
var cp = require("child_process");

var diagnosticCollection;

function activate(context) 
{
    diagnosticCollection = vscode.languages.createDiagnosticCollection('harbour');
	context.subscriptions.push(diagnosticCollection);
}

function deactivate()
{
	 diagnosticCollection.dispose();
}

var valRegEx = /([^\(]*)\((\d+)\)\s+(Warning|Error)\s+(.*)/
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
	process.stderr.on('data', data => 
	{
		//console.error(data.toString())
		var r = valRegEx.exec(data.toString().trim());
		if(r)
		{
			var lineNr = parseInt(r[2])-1;
			var lines = [textDocument.lineAt(lineNr)];
			while(lineNr>0)
			{
				lineNr--;
				var line = textDocument.lineAt(lineNr)
				if(line.text[line.text.length-1]==";")
				{
					lines.splice(0,0,line);
				} else
				{
					lineNr++;
					break;
				}
					
			}
			if(!(r[1] in diagnostics))
			{
				diagnostics[r[1]] = [];
			}
			var subject = r[4].match(/'([^']+)'/);
			var putAll = true;
			if(subject)
			{
				var m;
				var rr = new RegExp("\\b"+subject[1]+"\\b","ig")
				for (var i = 0; i < lines.length; i++) {
					line = lines[i];
					while(m=rr.exec(line.text))
					{
						putAll = false;
						diagnostics[r[1]].push(new vscode.Diagnostic(new vscode.Range(lineNr+i,m.index,lineNr+i,m.index+subject[1].length),
							r[4], r[3]=="Warning"? 1 : 0))
					}
					
				}
			} 
			if(putAll)
				diagnostics[r[1]].push(new vscode.Diagnostic(new vscode.Range(lineNr,0,lineNr+lines.length-1,Number.MAX_VALUE),
					r[4], r[3]=="Warning"? 1 : 0))
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
exports.validate = validate;
exports.removeValidation = removeValidation;