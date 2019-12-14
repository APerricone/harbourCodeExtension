var vscode = require('vscode');
var cp = require("child_process");
var path = require("path");
var localize = require("./myLocalize.js").localize;

var diagnosticCollection;

function activate(context) 
{
    diagnosticCollection = vscode.languages.createDiagnosticCollection('harbour');
	context.subscriptions.push(diagnosticCollection);

	vscode.workspace.onDidOpenTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidSaveTextDocument(validate,undefined, context.subscriptions);
	vscode.workspace.onDidCloseTextDocument(removeValidation,undefined, context.subscriptions);
	if(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
		validate(vscode.window.activeTextEditor.document);
}

function deactivate()
{
	 diagnosticCollection.dispose();
}

var valRegEx = /^\r?(?:([^\(]*)\((\d+)\)\s+)?(Warning|Error)\s+([^\r\n]*)/
function validate(textDocument)
{
	if(textDocument.languageId !== 'harbour' )
		return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.validating)
		return;
	var args = ["-s", "-q0", "-m", "-n0", "-w"+section.warningLevel, textDocument.fileName ];
	var file_cwd = vscode.workspace.rootPath;
	if(!file_cwd) {
		file_cwd=path.dirname(textDocument.fileName);
	}
	for (var i = 0; i < section.extraIncludePaths.length; i++) {
		var pathVal = section.extraIncludePaths[i];
		if(pathVal.indexOf("${workspaceFolder}")>=0) {
			pathVal=pathVal.replace("${workspaceFolder}",file_cwd)
		}
		args.push("-I"+pathVal);
	}
	args = args.concat(section.extraOptions.split(" ").filter(function(el) {return el.length != 0}));
	var diagnostics = {};
	diagnostics[textDocument.fileName] = [];
	var errorLines = "";
	function parseData(data)
	{
		errorLines += data.toString();
		errorLines = errorLines.replace(/[\r\n]/g,"\n")
		var p;
		while((p=errorLines.indexOf("\n"))>=0)
		{
			var subLine = errorLines.substring(0,p);
			errorLines = errorLines.substring(p+1);
			//console.error(data.toString())
			var r = valRegEx.exec(subLine);
			if(r)
			{
				if(!r[1]) r[1]="";
				var lineNr = r[2]? parseInt(r[2])-1 : 0;
				var subject = r[4].match(/'([^']+)'/g);
				if(subject && subject.length>1 && subject[1].indexOf("(")>=0)
				{
					var nsub = subject[1].match(/\(([0-9]+)\)/);
					if(nsub)
					{
						lineNr = parseInt(nsub[1])-1;
					}
				}
				var line = textDocument.lineAt(lineNr)
				if(!(r[1] in diagnostics))
				{
					diagnostics[r[1]] = [];
				}
				var putAll = true;
				if(subject)
				{
					var m;
					subject[0] = subject[0].substr(1,subject[0].length-2)
					var rr = new RegExp('\\b'+subject[0].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")+'\\b',"ig")
					while(m=rr.exec(line.text))
					{
						putAll = false;
						diagnostics[r[1]].push(new vscode.Diagnostic(new vscode.Range(lineNr,m.index,lineNr,m.index+subject[0].length),
							r[4], r[3]=="Warning"? 1 : 0))
					}
				} 
				if(putAll)
					diagnostics[r[1]].push(new vscode.Diagnostic(line.range,
						r[4], r[3]=="Warning"? 1 : 0))
			}
		}
	}
	var process = cp.spawn(section.compilerExecutable,args, { cwd: file_cwd });
	process.on("error", e=>
	{
		vscode.window.showWarningMessage(localize("harbour.validation.NoExe",section.compilerExecutable));
	});
	process.stderr.on('data', parseData);
	process.stdout.on('data', parseData);
	process.on("exit",function(code)
	{
		for (var file in diagnostics) {
			if (diagnostics.hasOwnProperty(file)) {
				var infos = diagnostics[file];
				diagnosticCollection.set(vscode.Uri.file(file), infos);		
			}
		}
	});
}

function removeValidation(textDocument)
{
	diagnosticCollection.delete(textDocument.uri);
}

exports.activate = activate;
exports.deactivate = deactivate;
