const vscode = require('vscode');
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const localize = require("./myLocalize.js").localize;
const getAllWorkspaceFiles = require("./utils.js").getAllWorkspaceFiles;

/**
 *
 * @param {String} v
 */
function resolvePredefinedVariables(v) {
    function replace(what,solved) {
        if(v.indexOf(what)>=0) {
            do {
                v=v.replace(what,solved);
            } while(v.indexOf(what)>=0);
        }
    }
    var textDocument = undefined;
    var parsed = undefined;
    if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
        textDocument =vscode.window.activeTextEditor.document;
        parsed = path.parse(textDocument.uri.fsPath);
    }
    var workspace0 = undefined, relativeParsed = undefined, relativePath = undefined;
    if(textDocument) {
        workspace0 = vscode.workspace.getWorkspaceFolder(textDocument.uri);
    }
    if(workspace0) {
        relativePath = path.relative(workspace0.uri.fsPath,textDocument.uri.fsPath);
        relativeParsed = path.parse(relativePath);
     }else
        workspace0 = vscode.workspace.workspaceFolders[0];
    replace("${workspaceFolder}", workspace0.uri.fsPath); //the path of the folder opened in VS Code
    replace("${workspaceFolderBasename}", workspace0.name) //the name of the folder opened in VS Code without any slashes (/)
    replace("${file}", textDocument? textDocument.uri.fsPath : ""); //  - the current opened file
    replace("${relativeFile}", relativePath? relativePath : ""); // the current opened file relative to workspaceFolder
    replace("${relativeFileDirname}", relativeParsed? relativeParsed.dir : ""); //the current opened file's dirname relative to workspaceFolder
    replace("${fileBasename}", parsed? parsed.base : ""); //the current opened file's basename
    replace("${fileBasenameNoExtension}", parsed? parsed.name:""); //the current opened file's basename with no file extension
    replace("${fileDirname}", parsed? path.basename(parsed.dir):""); //the current opened file's dirname
    replace("${fileExtname}", parsed? parsed.ext:""); //the current opened file's extension
    //replace("${cwd}"); //the task runner's current working directory on startup
    //replace("${lineNumber}"); //the current selected line number in the active file
    //replace("${selectedText}"); //the current selected text in the active file
    //replace("${execPath}"); //the path to the running VS Code executable
    //replace("${defaultBuildTask}"); //the name of the default build task
    return v;
}

class HRBTask {
    constructor() {
    }

    GetArgs(fileName) {
        var section = vscode.workspace.getConfiguration('harbour');
        var args = ["-w"+section.warningLevel, fileName ];
        for (var i = 0; i < section.extraIncludePaths.length; i++) {
            var pathVal = resolvePredefinedVariables(section.extraIncludePaths[i]);
            args.push("-I"+pathVal);
        }
        return args.concat(section.extraOptions.split(" ").filter(function(el) {return el.length != 0}));
    }

    provideTasks(token) {
        var textDocument = undefined;
        if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
            textDocument =vscode.window.activeTextEditor.document;
        var retValue = [];
    	if(textDocument && textDocument.languageId == 'harbour' ) {
            var section = vscode.workspace.getConfiguration('harbour');
            var args = this.GetArgs(textDocument.fileName);
            var file_cwd = path.dirname(textDocument.fileName);
            retValue.push(new vscode.Task({
                    "type": "Harbour",
                    "input": "${file}",
                    "output": "portable"
                }, vscode.TaskScope.Workspace, localize("harbour.task.portableName"),"Harbour",
                new vscode.ShellExecution(section.compilerExecutable,args.concat(["-gh"]),{
                    cwd: file_cwd
                }),"$harbour"));
            retValue.push(new vscode.Task({
                    "type": "Harbour",
                    "input": "${file}",
                    "output": "C code",
                    "c-type": "compact"
                }, vscode.TaskScope.Workspace, localize("harbour.task.cCodeName"),"Harbour",
                new vscode.ShellExecution(section.compilerExecutable,args.concat(["-gc0"]),{
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
    resolveTask(task, token) {
        var input=resolvePredefinedVariables(task.definition.input);
        var ext = path.extname(input);
        if(ext!=".prg")
            return undefined;
        var retTask = new vscode.Task(task.definition, vscode.TaskScope.Workspace,"build "+input ,"Harbour");

        var args = this.GetArgs(input);
        if(task.definition.output=="C code") {
            if("c-type" in task.definition) {
                var id = ["compact","normal",
                    "verbose","real C Code"].indexOf(task.definition["c-type"]);
                if(id>=0) {
                    args = args.concat(["-gc"+id]);
                } else args = args.concat(["-gc"]);
            } else args = args.concat(["-gc"]);
        } else
            args = args.concat(["-gh"]);
        var file_cwd = path.dirname(vscode.window.activeTextEditor.document.fileName);
        var section = vscode.workspace.getConfiguration('harbour');
        retTask.execution = new vscode.ShellExecution(section.compilerExecutable,args.concat(["-gc"]),{
            cwd: file_cwd
        });
        if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
            retTask.problemMatchers = ["$harbour"];
        else
            retTask.problemMatchers = task.problemMatchers;
        return retTask;
    }
}

var myTerminals = {};
/**
 *
 * @param {vscode.Task} task
 */
function getTerminalFn(task) {
    if(!(task.name in myTerminals)) {
        myTerminals[task.name]=undefined
    }
    return () => {
        if(!myTerminals[task.name])
            myTerminals[task.name]=new HBMK2Terminal(task);
        // check if the batch changed
        var taskBatch = getBatch(task);
        if((myTerminals[task.name].batch || taskBatch) && taskBatch!=myTerminals[task.name].batch) {
            myTerminals[task.name]=new HBMK2Terminal(task);
        }
        //
        var ret=myTerminals[task.name];
        ret.append(task);
        return ret;
    }
}

function ToAbsolute(fileName) {
    if(path.isAbsolute(fileName))
        return fileName;
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {
        let thisDir = vscode.workspace.workspaceFolders[i];
        /** @type {vscode.Uri} */
        let uri = vscode.Uri.parse(thisDir.uri)
        if (uri.scheme != "file") continue;
        const p = path.join(uri.fsPath,fileName);
        if(fs.existsSync(p)) {
            return p;
            break;
        }
    }
    return undefined;
}

function getBatch(task) {
    var batch = task.definition.setupBatch;
    var platform = process.platform;
    if(platform=='win32') platform="windows";
    if(platform=='darwin') platform="osx";
    //TODO: other platforms
    if(platform in task.definition) {
        var platformSpecific = task.definition[platform];
        if(platformSpecific.env) {
            var extraEnv = platformSpecific.env;
            for (const p in extraEnv) {
                if (extraEnv.hasOwnProperty(p)) {
                    this.env[p] = extraEnv[p];
                }
            }
        }
        if(platformSpecific.setupBatch)
            batch=platformSpecific.setupBatch;
    }
    return batch;
}

/** @implements {vscode.Pseudoterminal} */
class HBMK2Terminal {
    /**
     * @param {String} platform The parameter platfor of those tasks
     * @param {String} compiler The parameter compiler of those tasks
     * @param {batch} batch The parameter setupBatch of those tasks
     */
    constructor(task) {
        this.name = task.name;
        myTerminals[task.name]=this;
        this.write = ()=>{};
        this.closeEvt = ()=>{};
        this.tasks = [];
        /** @type {boolean} indicates that this HBMK2Terminal is executing the setup shell or batch */
        this.settingup = false;
        this.env=process.env;
        if(task.definition.options && task.definition.options.env) {
            var extraEnv = task.definition.options.env;
            for (const p in extraEnv) {
                if (extraEnv.hasOwnProperty(p)) {
                    this.env[p] = extraEnv[p];
                }
            }
        }
        var batch = getBatch(task);
        this.batch=batch;
        if(batch) {
            batch=ToAbsolute(batch);
            if(!batch) {
                this.unableToStart=true;
                return;
            }
            this.settingup = true;
            var cmd="setup"; //TODO: make unique
            if(os.platform()=='win32') {
                cmd+=".bat";
                fs.writeFileSync(cmd,
                    `call \"${batch}\"\r\nset\r\n`)
            } else {
                cmd="./"+cmd+".sh";
                fs.writeFileSync(cmd,
                    `sh  \"${batch}\"\r\printenv\r\n`)
            }
            var tc = this;
            var env1 = {};
            function onData(data) {
                /** @type{String[]} */
                var str = data.toString().split(/[\r\n]{1,2}/);
                for(let i=0;i<str.length-1;++i) {
                    var m = str[i].match(/([^=]+)=(.*)$/);
                    // I am not sure about the toUpperCase...
                    // on windows is necessary, on linux/mac I don't know
                    // I am not sure if all this is necessary on linux/mac
                    if(m) {
                        env1[ m[1].toUpperCase() ] = m[2];
                    } else
                        tc.write(str[i]+"\r\n");
                }
            }
            var p1 = cp.spawn( cmd,{env:process.env})
            p1.stdout.on('data', onData);
            p1.on("exit", () => {
                fs.unlink(cmd, ()=>{});
                tc.env=env1;
                tc.settingup = false;
                tc.start();
            });
        }
        this.write=()=>{};
    }
    onDidWrite(fn) {
        this.write=fn;
    }
    onDidClose(fn) {
        this.closeEvt=fn;
    }
    open(/*initialDimensions*/) {
        this.start();
    }
    append(t) {
        this.tasks.push(t);
    }
    close() {
        if(this.p) {
            this.p.kill();
        }
        myTerminals[this.name]=undefined;
    }
    start() {
        if(this.unableToStart) {
            this.write(localize("harbour.task.HBMK2.errorBatch")+".\r\n");
            this.closeEvt();
            return;
        }
        if(this.settingup){
            this.write(localize("harbour.task.HBMK2.setup")+"\r\n");
            return;
        }
        if(this.tasks.length==0)
            this.closeEvt(0);
        var task = this.tasks.splice(0,1)[0];
        var inputFile = ToAbsolute(resolvePredefinedVariables(task.definition.input)) || task.definition.input;
        var section = vscode.workspace.getConfiguration('harbour');

        var args = [inputFile, "-w"+section.warningLevel];
        if(task.definition.debugSymbols) {
            args.push("-b");
            args.push(path.resolve(__dirname, path.join('..','extra','dbg_lib.prg')));
        }
        if(task.definition.output) args.push("-o"+task.definition.output);
        if(Array.isArray(task.definition.extraArgs)) args=args.concat(task.definition.extraArgs);
        if(task.definition.platform) args.push("-plat="+task.definition.platform);
        if(task.definition.compiler) args.push("-comp="+task.definition.compiler);
        var file_cwd = path.dirname(inputFile);
        var hbmk2Path = path.join(path.dirname(section.compilerExecutable), "hbmk2")
        this.write(localize("harbour.task.HBMK2.start")+"\r\n")
        this.p = cp.spawn(hbmk2Path,args,{cwd:file_cwd,env:this.env});
        var tc = this;
        this.p.stderr.on('data', data =>
            tc.write(data.toString())
        );
        this.p.stdout.on('data', data =>
            tc.write(data.toString())
        );
        this.p.on("close", (r) => {
            tc.p = undefined;
            tc.closeEvt(r)
        });
        this.p.on("error", (r)=> {
            tc.p = undefined;
            tc.closeEvt(-1);
        });
    }
}

class HBMK2Task {
    getValidTask(name,input, definition, problemMathes) {
        var retTask = new vscode.Task({
            "type": "HBMK2",
            "input": input
            //"c-type": "compact"
        }, vscode.TaskScope.Workspace, name ,"HBMK2");
        retTask.definition = definition;
        retTask.execution = new vscode.CustomExecution(getTerminalFn(retTask));
        if(!Array.isArray(problemMathes) || problemMathes.length==0 )
            retTask.problemMatchers = ["$harbour","$msCompile"];
        return retTask;
    }

    /**
     *
     * @param {vscode.CancellationToken} token
     */
    provideTasks(token) {
        if(!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length==0)
            return [];
        var HBMK2This = this;
        return new Promise((resolve,reject)=> {
            var retValue=[];
            var textDocument = undefined;
            if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
                textDocument =vscode.window.activeTextEditor.document;
            if(textDocument && textDocument.languageId == 'harbour' ) {
                var task = new vscode.Task({
                    "type": "HBMK2",
                    "input": "${file}"
                }, vscode.TaskScope.Workspace, localize("harbour.task.HBMK2.provideName2") ,"HBMK2");
                task.execution = new vscode.CustomExecution(getTerminalFn(task));
                task.problemMatchers = ["$harbour","$msCompile"];
                var task2 = new vscode.Task({
                    "type": "HBMK2",
                    "input": "${file}",
                    "debugSymbols": true,
                    "output": "${fileBasenameNoExtension}_dbg"
                }, vscode.TaskScope.Workspace, localize("harbour.task.HBMK2.provideName3") ,"HBMK2");
                task2.execution = new vscode.CustomExecution(getTerminalFn(task));
                task2.problemMatchers = ["$harbour","$msCompile"];
                retValue.push(task,task2);
            }
            getAllWorkspaceFiles(token).then((values)=>{
                if(token.isCancellationRequested) {
                    reject(token);
                    return;
                }
                for(let j=0;j<values.length;j++) {
                    let ff = values[j];
                    for(let i=0;i<ff.length;++i) {
                        if(!ff[i].isFile()) continue;
                        var ext = path.extname(ff[i].name).toLowerCase();
                        if(ext==".hbp") {
                            var task = new vscode.Task({
                                    "type": "HBMK2",
                                    "input": ff[i].name
                                }, vscode.TaskScope.Workspace,
                                localize("harbour.task.HBMK2.provideName",path.basename(ff[i].name)) ,"HBMK2");
                            task.execution = new vscode.CustomExecution(getTerminalFn(task));
                            task.problemMatchers = ["$harbour","$msCompile"];
                            retValue.push(task);
                        }
                    }
                }
                resolve(retValue);
            });
        });
    }

    /**
     *
     * @param {vscode.Task} retTask
     * @param {vscode.CancellationToken} token
     */
    resolveTask(task) {
        var retTask = new vscode.Task(task.definition, vscode.TaskScope.Workspace,
                "build "+task.definition.input ,"HBMK2");
        retTask.execution = new vscode.CustomExecution(getTerminalFn(retTask));
        if(!Array.isArray(task.problemMatchers) || task.problemMatchers.length==0 )
            retTask.problemMatchers = ["$harbour","$msCompile"];
        else
            retTask.problemMatchers = task.problemMatchers;
        return retTask;
    }
}
function activate() {
	vscode.tasks.registerTaskProvider("Harbour", new HRBTask());
	vscode.tasks.registerTaskProvider("HBMK2", new HBMK2Task());
}

exports.activate = activate;
exports.HBMK2Task = HBMK2Task;