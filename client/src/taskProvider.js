const vscode = require('vscode');
const path = require("path");
const fs = require("fs");

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
    var retValue = [];
	if(textDocument.languageId == 'harbour' ) {
    var section = vscode.workspace.getConfiguration('harbour');
	var args = GetArgs(section);
	var file_cwd = path.dirname(textDocument.fileName);
    retValue.push(new vscode.Task({
            type: "Harbour",
            output: "portable"
        }, vscode.TaskScope.Workspace,
            "Harbour Portable Object generator"));
    retValue.push(new vscode.Task({
            type: "Harbour",
            "output": "C code",
            "c-type": "compact"
        }, vscode.TaskScope.Workspace,
            "Harbour generate C code"));
    }
    if(vscode.workspace.workspaceFolders)
        for(let d=0;d<vscode.workspace.workspaceFolders;d++) {
            let thisDir = vscode.workspace.workspaceFolders[d];
            /** @type {vscode.Uri} */
            var uri = vscode.Uri.parse(thisDir.uri)
            if (uri.scheme != "file") continue;
            fs.readdir(uri.fsPath, (err,ff) => {
                for(let i=0;i<ff.length;++i) {
                    var ext = path.extname(ff[i]).toLowerCase();
                    if(ext==".hbp") {
                        retValue.push(new vscode.Task({
                            type: "HBMK2",
                            "input": ff[i],
                            "c-type": "compact"
                        }, vscode.TaskScope.Workspace,
                            "build "+path.basename ));
                    }
                }
            });
        }
    return retValue;
}

/**
 *
 * @param {vscode.Task} task
 * @param {*} token
 */
function HRB_resolveTask(task) {
    var section = vscode.workspace.getConfiguration('harbour');
    if(task.definition.type=="harbour") {
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
        return task;
    }
    if(task.definition.type=="HBMK2") {
        var args = [task.definition.input];
        if(task.definition.debugSymbols) {
            args.push("-b");
            args.push(path.resolve(__dirname, path.join('..','extra','dbg_lib.prg')));
        }
        if(task.definition.output) args.push("-o"+task.definition.output);
        args.concat(task.definition.libraries);
        if(task.definition.platform) args.push("-plat="+task.definition.platform);
        if(task.definition.compiler) args.push("-comp="+task.definition.compiler);
        var file_cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
        var hbmk2Path = path.join(path.dirname(section.compilerExecutable), "hbkm2")
        if(task.definition.compiler) {
            var bat;
            switch(task.definition.compiler)
            {
                case "msvc":
                    bat="vcvars32.bat"
                    break;
                case "msvc64":
                    bat="vcvars64.bat"
                    break;
                case "msvcarm":
                    bat="vcvarsamd64_arm.bat"
                    break;
            }
            if(bat) {
                hbmk2Path="CALL \"c:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community\\VC\\Auxiliary\\Build\\"+bat+"\" && "+hbmk2Path
            }
        }
        task.execution = new vscode.ShellExecution(hbmk2Path,args,{
            cwd: file_cwd
        });
        if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
            task.problemMatchers = ["$harbour","$msCompile"];
        return task;
    }
    return undefined;
}

function activate() {
	vscode.tasks.registerTaskProvider("Harbour",{
        provideTasks: HRB_provideTasks,
        resolveTask: HRB_resolveTask
    });
}

exports.activate = activate;
