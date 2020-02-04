const vscode = require('vscode');
const path = require("path");

function GetArgs(section) {
    var textDocument = vscode.window.activeTextEditor.document;
	var args = ["-w"+section.warningLevel, textDocument.fileName ];
	for (var i = 0; i < section.extraIncludePaths.length; i++) {
		var pathVal = section.extraIncludePaths[i];
		if(pathVal.indexOf("${workspaceFolder}")>=0) {
			pathVal=pathVal.replace("${workspaceFolder}",file_cwd)
		}
		args.push("-I"+pathVal);
	}
    return args.concat(section.extraOptions.split(" ").filter(function(el) {return el.length != 0}));
}

function HRB_provideTasks(token) {
    var textDocument = vscode.window.activeTextEditor.document;
	if(textDocument.languageId !== 'harbour' ) return [];
    var section = vscode.workspace.getConfiguration('harbour');
	var args = GetArgs(section);
	var file_cwd = path.dirname(textDocument.fileName);
    return [
        new vscode.Task({
            type: "Harbour",
            output: "portable"
        }, vscode.TaskScope.Workspace,
            "Harbour Portable Object generator","harbour.exe",
            new vscode.ShellExecution(section.compilerExecutable,args.concat("-gh"),{
                cwd: file_cwd
            })),
        new vscode.Task({
            type: "Harbour",
            "output": "C code",
            "c-type": "compact"
        }, vscode.TaskScope.Workspace, "Harbour generate C code","harbour.exe",
        new vscode.ShellExecution(section.compilerExecutable,args.concat("-gc"),{
            cwd: file_cwd
        }))];
}

/**
 *
 * @param {vscode.Task} task
 * @param {*} token
 */
function HRB_resolveTask(task) {
    var section = vscode.workspace.getConfiguration('harbour');
    var args = GetArgs(section);
    if(task.definition.output=="C code")
        args = args.concat(["-gc"]);
    else
        args = args.concat(["-gh"]);
    var file_cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
    task.execution = new vscode.ShellExecution(section.compilerExecutable,args,{
        cwd: file_cwd
    });
    if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
        task.problemMatchers = ["$harbour","$msCompile"];
    task.type="shell";
    return task;
}

function activate() {
	vscode.tasks.registerTaskProvider("Harbour",{
        provideTasks: HRB_provideTasks,
        resolveTask: HRB_resolveTask
    });
}

exports.activate = activate;
