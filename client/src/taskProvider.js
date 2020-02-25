const vscode = require('vscode');
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const localize = require("./myLocalize.js").localize;

class HRBTask {
    constructor() {
    }

    GetArgs(fileName) {
        var section = vscode.workspace.getConfiguration('harbour');
        var args = ["-w"+section.warningLevel, fileName ];
        for (var i = 0; i < section.extraIncludePaths.length; i++) {
            var pathVal = section.extraIncludePaths[i];
            if(pathVal.indexOf("${workspaceFolder}")>=0) {
                pathVal=pathVal.replace("${workspaceFolder}",file_cwd)
            }
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
                    "output": "portable"
                }, localize("harbour.task.portableName"),"Harbour",
                new vscode.ShellExecution(section.compilerExecutable,args.concat(["-gh"]),{
                    cwd: file_cwd
                }),"$harbour"));
            retValue.push(new vscode.Task({
                    "type": "Harbour",
                    "output": "C code",
                    "c-type": "compact"
                }, localize("harbour.task.cCodeName"),"Harbour",
                new vscode.ShellExecution(section.compilerExecutable,args.concat(["-gc"]),{
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
        var input=task.definition.input;
        if(!input || input=="${file}") {
            var textDocument = undefined;
            if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
                textDocument =vscode.window.activeTextEditor.document;
            if(textDocument && textDocument.languageId != 'harbour' )
                return undefined;
            input=textDocument.fileName;
        }
        var ext = path.extname(input);
        if(ext!=".prg")
            return undefined;
        var retTask = new vscode.Task(task.definition,"build "+input ,"Harbour");

        var args = this.GetArgs(input);
        if(task.definition.output=="C code")
            args = args.concat(["-gc"]);
        else
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
        var inputFile = ToAbsolute(task.definition.input) || task.definition.input;
        if(!inputFile || inputFile=="${file}") {
            var textDocument = undefined;
            if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
                textDocument =vscode.window.activeTextEditor.document;
            if(!textDocument) {
                tc.closeEvt(-1);
                return undefined;
            }
            inputFile=textDocument.fileName;
        }

        var args = [inputFile];
        if(task.definition.debugSymbols) {
            args.push("-b");
            args.push(path.resolve(__dirname, path.join('..','extra','dbg_lib.prg')));
        }
        if(task.definition.output) args.push("-o"+task.definition.output);
        args=args.concat(task.definition.extraArgs);
        if(task.definition.platform) args.push("-plat="+task.definition.platform);
        if(task.definition.compiler) args.push("-comp="+task.definition.compiler);
        var file_cwd = path.dirname(inputFile);
        var section = vscode.workspace.getConfiguration('harbour');
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
        }, name ,"HBMK2");
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
                            var task = new vscode.Task({
                                "type": "HBMK2",
                                "input": ff[i].name
                                //"c-type": "compact"
                            }, localize("harbour.task.HBMK2.provideName",path.basename(ff[i].name)) ,"HBMK2");
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
        var retTask = new vscode.Task(task.definition,"build "+task.definition.input ,"HBMK2");
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
