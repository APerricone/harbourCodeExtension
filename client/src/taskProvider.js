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
    var textDocument = undefined;
    if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
        textDocument =vscode.window.activeTextEditor.document;
    var retValue = [];
	if(textDocument && textDocument.languageId == 'harbour' ) {
        var section = vscode.workspace.getConfiguration('harbour');
        var args = GetArgs(section);
        var file_cwd = path.dirname(textDocument.fileName);
        retValue.push(new vscode.Task({
                "type": "Harbour",
                "output": "portable"
            }, "Generate Harbour Portable Object (hrb)","Harbour",
            new vscode.ProcessExecution(section.compilerExecutable,args.concat(["-gh"]),{
                cwd: file_cwd
            }),"$harbour"));
        retValue.push(new vscode.Task({
                "type": "Harbour",
                "output": "C code",
                "c-type": "compact"
            }, "Generate C file","Harbour",
            new vscode.ProcessExecution(section.compilerExecutable,args.concat(["-gc"]),{
                cwd: file_cwd
            }),"$harbour"));
    }
    return retValue;
}

/**
 *
 * @param {vscode.Task} task
 * @param {vscode.CancellationToken} token
 */
function HRB_resolveTask(task) {
    var section = vscode.workspace.getConfiguration('harbour');
    var args = GetArgs(section);
    if(task.definition.output=="C code")
        args = args.concat(["-gc"]);
    else
        args = args.concat(["-gh"]);
    var file_cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
    task.execution = new vscode.ProcessExecution(section.compilerExecutable,args,{
        cwd: file_cwd
    });
    if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
        task.problemMatchers = ["$harbour","$msCompile"];
    return task;
}


/**
 *
 * @param {vscode.CancellationToken} token
 */

function HBMK2_provideTasks(token) {
    if(!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length==0)
        return [];
    return new Promise((resolve,reject)=> {
        /** @type{Array<Promise>} */
        var promises = [];
        for(let d=0;d<vscode.workspace.workspaceFolders.length;d++) {
            let thisDir = vscode.workspace.workspaceFolders[d];
            /** @type {vscode.Uri} */
            var uri = vscode.Uri.parse(thisDir.uri)
            if (uri.scheme != "file") continue;
            //var r = promisify();
            var r = new Promise((res,rej)=>{
                if(token.isCancellationRequested) {
                    reject(token);
                    return;
                }
                fs.readdir(uri.fsPath, {withFileTypes: true},(err,ff)=>{
                    if(token.isCancellationRequested) {
                        reject(token);
                        return;
                    }
                    res(ff);
                })
            });
            promises.push(r);
        }
        Promise.all(promises).then((values)=>{
            if(token.isCancellationRequested) {
                reject(token);
                return;
            }
            var retValue=[];
            for(let j=0;j<values.length;j++) {
                let ff = values[j];
                for(let i=0;i<ff.length;++i) {
                    if(!ff[i].isFile()) continue;
                    var ext = path.extname(ff[i].name).toLowerCase();
                    if(ext==".hbp") {
                        retValue.push(HBMK2_resolveTask(new vscode.Task({
                            "type": "HBMK2",
                            "input": ff[i].name
                            //"c-type": "compact"
                        }, "build "+path.basename(ff[i].name) ,"HBMK2")));
                    }
                }
            }
            resolve(retValue);
        });
    });
}

/**
 *
 * @param {vscode.Task} task
 * @param {vscode.CancellationToken} token
 */
function HBMK2_resolveTask(task) {
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
    var section = vscode.workspace.getConfiguration('harbour');
    var hbmk2Path = path.join(path.dirname(section.compilerExecutable), "hbmk2")
    /*if(task.definition.compiler) {
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
    }*/
    task.execution = new vscode.ProcessExecution(hbmk2Path,args,{
        cwd: file_cwd
    });
    if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
        task.problemMatchers = ["$harbour","$msCompile"];
    return task;
}

function activate() {
	vscode.tasks.registerTaskProvider("Harbour",{
        provideTasks: HRB_provideTasks,
        resolveTask: HRB_resolveTask
    });
	vscode.tasks.registerTaskProvider("HBMK2",{
        provideTasks: HBMK2_provideTasks,
        resolveTask: HBMK2_resolveTask
    });
}

exports.activate = activate;
