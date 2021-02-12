const vscode = require('vscode');
const cp = require("child_process");
const path = require("path");
const localize = require("./myLocalize.js").localize;
const readline = require("readline");

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
var lineContRegEx = /;(\s*(\/\/|&&|\/\*))?/
function validate(textDocument)
{
	if(textDocument.languageId !== 'harbour' )
		return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.validating)
		return;
	var args = ["-s", "-q0", "-m", "-n0", "-w"+section.warningLevel, textDocument.fileName ];
	var file_cwd = path.dirname(textDocument.fileName);
	for (var i = 0; i < section.extraIncludePaths.length; i++) {
		var pathVal = section.extraIncludePaths[i];
		if(pathVal.indexOf("${workspaceFolder}")>=0) {
			pathVal=pathVal.replace("${workspaceFolder}",file_cwd)
		}
		args.push("-I"+pathVal);
	}
	args = args.concat(section.extraOptions.split(" ").filter(function(el) {return el.length != 0 || el=="-ge1"}));
	var diagnostics = {};
	diagnostics[textDocument.fileName] = [];
	function parseLine(subLine)
	{
		var r = valRegEx.exec(subLine);
		if(r)
		{
			if(!r[1]) r[1]="";
			var lineNr = r[2]? parseInt(r[2])-1 : 0;
			var subject = r[4].match(/'([^']+)'/g);
			if(subject && subject.length>1 && subject[1].indexOf("(")>=0)
			{
				var nSub = subject[1].match(/\(([0-9]+)\)/);
				if(nSub)
				{
					lineNr = parseInt(nSub[1])-1;
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
				var testLine = line;
				do {
					while(m=rr.exec(testLine.text))
					{
						putAll = false;
						var diag = new vscode.Diagnostic(new vscode.Range(lineNr,m.index,lineNr,m.index+subject[0].length), r[4],
							r[3]=="Warning"? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error)
						if(r[4].indexOf("not used")>0) {
							diag.tags = [vscode.DiagnosticTag.Unnecessary];
						}
						diagnostics[r[1]].push(diag)
					}
					testLine = textDocument.lineAt(--lineNr);
				} while(lineContRegEx.test(testLine.text))
			}
			if(putAll)
				diagnostics[r[1]].push(new vscode.Diagnostic(line.range, r[4], r[3]=="Warning"? 1 : 0))
		}
	}
	var process = cp.spawn(section.compilerExecutable,args, { cwd: file_cwd });
	process.on("error", e=>
	{
		vscode.window.showWarningMessage(localize("harbour.validation.NoExe",section.compilerExecutable));
	});
	var reader = readline.createInterface({ input: process.stderr})
	reader.on("line",d=>parseLine(d));
	//process.stderr.on('data', (v) => parseData(v,true));
	//process.stdout.on('data', (v) => parseData(v,false));
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
