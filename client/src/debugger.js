const debugadapter = require("@vscode/debugadapter");
const debugprotocol = require("@vscode/debugprotocol");
const net = require("net");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const localize = require("./myLocalize.js").localize;
const process = require("process")
const trueCase = require("true-case-path");
const platform = require("os").platform();
var winMonitor = undefined;
if(platform=="win32") {
    winMonitor = require("@yagisumi/win-output-debug-string").monitor;
}

// https://code.visualstudio.com/updates/v1_30#:~:text=Finalized%20Debug%20Adapter%20Tracker%20API
/** @requires vscode-debugadapter   */
/// CLASS DEFINITION

/**
 * container for
 */
class HBVar {
    /***
     * @param command {String}
     **/
    constructor(command) {
        this.command = command
        this.response = undefined;
        this.evaluation = ""
    }
}

/**
 * The debugger
 */
class harbourDebugSession extends debugadapter.DebugSession {
    constructor() {
        super();
        /** @type{net.socket} */
        this.socket = null;
        /** @type{boolean} */
        this.Debbugging = true;
        this.sourcePaths = [];
        /** @description the current process line function
         * @type{function(string)} */
        this.processLine = undefined;
        this.breakpoints = {};
        /** @type{HBVar[]} */
        this.variables = [];
        /** @type{DebugProtocol.StackResponse} */
        this.stack = [];
        this.stackArgs = [];
        this.justStart = true;
        /** @type{string} */
        this.queue = "";
        this.evaluateResponses = [];
        /** @type{DebugProtocol.CompletionsResponse} */
        this.completionsResponse = undefined;
        this.areasInfos = [];
        this.processId = undefined;
    }

    /**
     * process data from debugging process.
     * @param buff{string} the imported data
     */
    processInput(buff) {
        var lines = buff.split("\r\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            //if(!line.startsWith("LOG:")) this.sendEvent(new debugadapter.OutputEvent(">>"+line+"\r\n","stdout"))
            if (line.length == 0) continue;
            if (this.processLine) {
                this.processLine(line);
                continue;
            }
            if (line.startsWith("STOP")) {
                this.sendEvent(new debugadapter.StoppedEvent(line.substring(5), 1));
                continue;
            }
            if (line.startsWith("STACK")) {
                this.sendStack(line);
                continue;
            }
            if (line.startsWith("BREAK")) {
                this.processBreak(line);
                continue;
            }
            if (line.startsWith("ERROR") && !line.startsWith("ERROR_VAR")) {
                //console.log("ERROR")
                var stopEvt = new debugadapter.StoppedEvent("error", 1, line.substring(6));
                this.sendEvent(stopEvt);
                continue;
            }
            if (line.startsWith("EXPRESSION")) {
                this.processExpression(line);
                continue;
            }
            if (line.startsWith("LOG")) {
                this.sendEvent(new debugadapter.OutputEvent(line.substring(4) + "\r\n", "stdout"))
                continue;
            }
            if (line.startsWith("INERROR")) {
                this.sendScope(line[8] == 'T')
                continue;
            }
            if (line.startsWith("COMPLETITION")) {
                this.processCompletion(line);
                continue;
            }
            for (var j = this.variables.length - 1; j >= 0; j--) {
                if (line.startsWith(this.variables[j].command)) {
                    this.sendVariables(j, line);
                    break;
                }
            }
            if (j != this.variables.length) continue;
        }
    }

    /**
     * @param response{debugprotocol.InitializeResponse}
     * @param args{debugprotocol.InitializeRequestArguments}
     */
    initializeRequest(response, args) {
        if (args.locale) {
            require("./myLocalize.js").reInit(args);
        }

        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsDelayedStackTraceLoading = false;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsLogPoint = true;
        response.body.supportsCompletionsRequest = true;
        response.body.supportsTerminateRequest = true;
        response.body.exceptionBreakpointFilters = [
            {
                label: localize('harbour.dbgError.all'),
                filter: 'all',
                default: false
            },
            {
                label: localize('harbour.dbgError.notSeq'),
                filter: 'notSeq',
                default: true
            }
        ];
        //response.body.supportsEvaluateForHovers = true; too risky
        this.sendResponse(response);
    }

    configurationDoneRequest(response, args) {
        if (this.startGo) {
            this.command("GO\r\n");
            this.sendEvent(new debugadapter.ContinuedEvent(1, true));
        }
        this.sendResponse(response);
    }

    /**
     * 
     * @param {debugprotocol.DebugProtocol.LaunchRequest} response 
     * @param {debugprotocol.DebugProtocol.LaunchRequestArguments} args 
     */
    launchRequest(response, args) {
        var port = args.port ? args.port : 6110;
        var tc = this;
        this.justStart = true;
        this.sourcePaths = []; //[path.dirname(args.program)];
        if ("workspaceRoot" in args) {
            this.sourcePaths.push(args.workspaceRoot);
        }
        if ("sourcePaths" in args) {
            this.sourcePaths = this.sourcePaths.concat(args.sourcePaths);
        }
        for (let idx = 0; idx < this.sourcePaths.length; idx++) {
            try {
                this.sourcePaths[idx] = trueCase.trueCasePathSync(this.sourcePaths[idx]);
            } catch (ex) {
                // path no found
                this.sourcePaths.splice(idx, 1);
                idx--;
            }
        }
        this.Debugging = !args.noDebug;
        this.startGo = args.stopOnEntry === false || args.noDebug === true;
        // starts the server
        var server = net.createServer(socket => {
            tc.evaluateClient(socket, server, args)
        }).listen(port);
        // starts the program
        //console.log("start the program");
        switch (args.terminalType) {
            case 'external':
            case 'integrated':
                this.runInTerminalRequest({
                    "kind": args.terminalType,
                    "cwd": args.workingDir,
                    "env": args.env,
                    "args": [args.program].concat(args.arguments ? args.arguments : [])
                }, undefined, runResp =>{
                    if(runResp && runResp.body && runResp.body.processId) {
                        tc.setProcess(runResp.body.processId)
                    }
                })
                break;
            case 'none':
            default:
                var process;
                if (args.arguments)
                    process = cp.spawn(args.program, args.arguments, { cwd: args.workingDir, env: args.env });
                else
                    process = cp.spawn(args.program, { cwd: args.workingDir, env: args.env });
                process.on("error", e => {
                    tc.sendEvent(new debugadapter.OutputEvent(localize("harbour.dbgError1", args.program, args.workingDir), "stderr"))
                    tc.sendEvent(new debugadapter.TerminatedEvent());
                    return
                });
                process.on("exit", (code,signal) => {
                    tc.sendEvent(new debugadapter.ExitedEvent(code));
                    if(!tc.processId) {
                        tc.sendEvent(new debugadapter.OutputEvent(localize("harbour.prematureExit", code), "stderr"))
                        tc.sendEvent(new debugadapter.TerminatedEvent());
                    }
                });
                process.stderr.on('data', data =>
                    tc.sendEvent(new debugadapter.OutputEvent(data.toString(), "stderr"))
                );
                process.stdout.on('data', data =>
                    tc.sendEvent(new debugadapter.OutputEvent(data.toString(), "stdout"))
                );
                if(process.pid)
                    this.setProcess(process.pid)
                break;
        }
        this.sendResponse(response);
    }

    /**
     * 
     * @param {debugprotocol.DebugProtocol.AttachResponse} response 
     * @param {debugprotocol.DebugProtocol.AttachRequestArguments} args 
     */
    attachRequest(response, args) {
        var port = args.port ? args.port : 6110;
        if (args.process <= 0 && (args.program || "").length == 0) {
            response.success = false;
            response.message = "invalid parameter";
            this.sendResponse(response);
            return;
        }
        var tc = this;
        this.justStart = true;
        this.sourcePaths = []; //[path.dirname(args.program)];
        if ("workspaceRoot" in args) {
            this.sourcePaths.push(args.workspaceRoot);
        }
        if ("sourcePaths" in args) {
            this.sourcePaths = this.sourcePaths.concat(args.sourcePaths);
        }
        for (let idx = 0; idx < this.sourcePaths.length; idx++) {
            try {
                this.sourcePaths[idx] = trueCase.trueCasePathSync(this.sourcePaths[idx]);
            } catch (ex) {
                // path no found
                this.sourcePaths.splice(idx, 1);
                idx--;
            }
        }
        this.Debugging = !args.noDebug;
        this.startGo = true;
        // starts the server
        var server = net.createServer(socket => {
            tc.evaluateClient(socket, server, args)
        }).listen(port);
        this.sendResponse(response);
    }

    setProcess(pid) {
        var tc = this
        if(!pid) {
            return
        }
        if(this.processId) {
            if(this.processId != pid) {
                // uncomment for debugging
                //throw new Error("2 pid?! "+this.processId +" and "+ pid)
            }
            return
        }
        this.processId = pid;
        winMonitor?.start(mInfo=>{
            if(mInfo.pid==pid) {
                this.sendEvent(new debugadapter.OutputEvent(mInfo.message + "\r\n", "console"))
            }
        })
        var interval = setInterval(() => {
            try {
                process.kill(pid, 0);
            } catch (error) {
                winMonitor?.stop()
                tc.sendEvent(new debugadapter.TerminatedEvent());
                clearInterval(interval);
            }
        }, 1000)
    }

    disconnectRequest(response, args) {
        this.command("DISCONNECT\r\n");
        this.sendResponse(response);
    }

    terminateRequest(response, args) {
        process.kill(this.processId, 'SIGKILL');
        this.sendResponse(response);
    }

    /**
     * 
     * @param {net.Socket} socket 
     * @param {net.Server} server 
     * @param {debugprotocol.DebugProtocol.LaunchRequestArguments|debugprotocol.DebugProtocol.AttachRequestArguments} args 
     */
    evaluateClient(socket, server, args) {
        var tc = this;

        socket.on("data", data => {
            try {
                if (tc.socket == socket) {
                    tc.processInput(data.toString())
                    return;
                }
                // the client sended exe name and process ID
                var lines = data.toString().split("\r\n");
                if (lines.length < 2) {//todo: check if they arrive in 2 tranches.
                    socket.write("NO\r\n")
                    socket.end();
                    return;
                }
                var processId = parseInt(lines[1]);
                if(tc.processId) {
                    if(tc.processId!=processId) {
                        socket.write("NO\r\n")
                        socket.end();
                        return;
                    }
                } else {
                    if (args.program && args.program.length > 0) {
                        var exeTarget = path.basename(args.program, path.extname(args.program)).toLowerCase();
                        var clPath = path.basename(lines[0], path.extname(lines[0])).toLowerCase();
                        if (clPath != exeTarget) {
                            socket.write("NO\r\n")
                            socket.end();
                            return;
                        }
                    }

                    if (args.process && args.process > 0 && args.process != processId) {
                        socket.write("NO\r\n")
                        socket.end();
                        return;
                    }
                }

                socket.write("HELLO\r\n")
                tc.setProcess(processId);
                //connected!
                tc.sendEvent(new debugadapter.InitializedEvent());
                server.close();
                tc.socket = socket;
                socket.removeAllListeners("data");
                socket.on("data", data => {
                    tc.processInput(data.toString())
                });
                socket.write(tc.queue);
                this.justStart = false;
                tc.queue = "";
            } catch (ex) {
                socket.write("NO\r\n")
                socket.end();
            }
        });
    }

    command(cmd) {
        if (this.justStart)
            this.queue += cmd;
        else
            this.socket.write(cmd);
    }

    /// STACK
    /**
     * @param response{DebugProtocol.StackTraceResponse} response to send
     * @param args{DebugProtocol.StackTraceArguments} arguments
     */
    stackTraceRequest(response, args) {
        // reset references
        this.variables = [];

        if (this.stack.length == 0)
            this.command("STACK\r\n");
        this.stack.push(response);
        this.stackArgs.push(args);
    }

    threadsRequest(response) {
        response.body =
        {
            threads:
                [ //TODO: suppport multi thread
                    new debugadapter.Thread(1, "Main Thread")
                ]
        };
        this.sendResponse(response)
    }

    sendStack(line) {
        var nStack = parseInt(line.substring(6));
        var frames = [];
        frames.length = nStack;
        var j = 0;
        this.processLine = function (line) {
            var infos = line.split(":");
            for (let i = 0; i < infos.length; i++) infos[i] = infos[i].replace(";", ":")
            var completePath = infos[0]
            var found = false;
            if (infos[0].length > 0) {
                if (path.isAbsolute(infos[0]) && fs.existsSync(infos[0])) {
                    completePath = infos[0];
                    found = true;
                    try {
                        completePath = trueCase.trueCasePathSync(infos[0]);
                    } catch (ex) { }
                } else
                    for (let i = 0; i < this.sourcePaths.length; i++) {
                        if (fs.existsSync(path.join(this.sourcePaths[i], infos[0]))) {
                            completePath = path.join(this.sourcePaths[i], infos[0]);
                            found = true;
                            try {
                                completePath = trueCase.trueCasePathSync(infos[0], this.sourcePaths[i]);
                            } catch (ex) {
                                try {
                                    completePath = trueCase.trueCasePathSync(completePath);
                                } catch (ex2) { }
                            }
                            break;
                        }
                    }
            }
            if (found) infos[0] = path.basename(completePath);
            frames[j] = new debugadapter.StackFrame(j, infos[2],
                new debugadapter.Source(infos[0], completePath),
                parseInt(infos[1]));
            j++;
            if (j == nStack) {
                while (this.stack.length > 0) {
                    var args = this.stackArgs.shift();
                    var resp = this.stack.shift();
                    args.startFrame = args.startFrame || 0;
                    args.levels = args.levels || frames.length;
                    args.levels += args.startFrame;
                    resp.body = {
                        stackFrames: frames.slice(args.startFrame, args.levels)
                    };
                    this.sendResponse(resp);
                }
                this.processLine = undefined;
            }
        }
    }

    /// VARIABLES
    scopesRequest(response, args) {
        // save wanted stack
        this.currentStack = args.frameId + 1;

        this.scopeResponse = response
        this.command("INERROR\r\n")
    }

    sendScope(inError) {
        var commands = [];
        if (inError) commands.push("ERROR_VAR")
        commands = commands.concat(["LOCALS", "PUBLICS", "PRIVATES", "PRIVATE_CALLEE", "STATICS", "WORKAREAS"]);
        var n = this.variables.findIndex((v) => v.command==commands[0]);
        if (n < 0) {
            n = this.variables.length;
            // TODO: put these 3 members together on 'AOS'
            commands.forEach((cmd) => {
                this.variables.push(new HBVar(cmd));
            })
        }
        var scopes = [];
        if (inError) scopes.push(new debugadapter.Scope("Error", ++n))
        scopes = scopes.concat([
            new debugadapter.Scope("Local", ++n),
            new debugadapter.Scope("Public", ++n),
            new debugadapter.Scope("Private local", ++n),
            new debugadapter.Scope("Private external", ++n),
            new debugadapter.Scope("Statics", ++n),
            new debugadapter.Scope("Workareas", ++n)
        ])
        var response = this.scopeResponse;
        response.body = { scopes: scopes };
        this.sendResponse(response)
    }

    /**
     * @param {String} cmd
     */
    sendAreaHeaders(response, cmd) {
        // AREA:Alias:Area:fCount:recno:reccount:scope:
        //   0    1    2     3      4     5       6
        var infos = this.areasInfos[parseInt(cmd.substring(4))];
        var vars = [];
        var baseEval = infos[1] + "->"
        var v, recNo = parseInt(infos[4]), recCount = parseInt(infos[5]);
        v = new debugadapter.Variable("recNo", infos[4]);
        if (recNo > recCount) v.value = "eof"
        if (recNo <= 0) v.value = "bof"
        v.evaluateName = baseEval + "(recNo())"
        vars.push(v);
        v = new debugadapter.Variable("recCount", infos[5]);
        v.evaluateName = baseEval + "(recCount())"
        vars.push(v);
        v = new debugadapter.Variable("Scope", '"' + infos[6] + '"')
        v.evaluateName = baseEval + "(OrdName(IndexOrd()))"
        v.type = "C"
        vars.push(v);
        var columns = new debugadapter.Variable("Fields", "")
        columns.indexedVariables = parseInt(infos[3]);
        columns.variablesReference = this.getVarReference(cmd + ":FIELDS", baseEval);
        vars.push(columns);
        response.body = { variables: vars }
        this.sendResponse(response)
    }

    variablesRequest(response, args) {
        if (args.variablesReference <= this.variables.length) {
            var hbStart = args.start ? args.start + 1 : 1;
            var hbCount = args.count ? args.count : 0;
            var cmd = this.variables[args.variablesReference - 1].command;
            if (cmd.startsWith("AREA") && cmd.indexOf(":") < 0) {
                this.sendAreaHeaders(response, cmd)
                return;
            }
            this.variables[args.variablesReference - 1].response = response;
            this.command(`${cmd}\r\n${this.currentStack}:${hbStart}:${hbCount}\r\n`);
        } else
            this.sendResponse(response)
    }

    getVarReference(line, evalTxt) {
        var r = this.variables.findIndex((v) => v.command==line);
        if (r >= 0) return r + 1;
        var infos = line.split(":");
        if (infos.length > 4) { //the value can contains : , we need to rejoin it.
            infos[2] = infos.splice(2).join(":").slice(0, -1);
            infos.length = 3;
            line = infos.join(":") + ":"
        }
        var hbVar = new HBVar(line)
        hbVar.evaluation = evalTxt;
        this.variables.push(hbVar)
        //this.sendEvent(new debugadapter.OutputEvent("added variable command:'"+line+"'\r\n","stdout"))
        return this.variables.length;
    }

    getVariableFormat(dest, type, value, valueName, line, id) {
        if (type == "C") {
            value = value.replace(/\\\$\\n/g, "\n")
            value = value.replace(/\\\$\\r/g, "\r")
        }
        dest[valueName] = value;
        dest.type = type;
        if (["E", "B", "P"].indexOf(dest.type) == -1 && id>=0 && id<this.variables.length) {
            dest.evaluateName = "";
            if (this.variables[id].evaluation)
                dest.evaluateName = this.variables[id].evaluation;
            dest.evaluateName += dest.name;
            if (this.variables[id].evaluation && this.variables[id].evaluation.endsWith("["))
                dest.evaluateName += "]";
        }
        switch (type) {
            case "A":
                dest.variablesReference = this.getVarReference(line, dest.evaluateName + "[");
                dest[valueName] = `ARRAY(${value})`;
                dest.indexedVariables = parseInt(value);
                break;
            case "H":
                dest.variablesReference = this.getVarReference(line, dest.evaluateName + "[");
                dest[valueName] = `HASH(${value})`;
                dest.namedVariables = parseInt(value);
                break;
            case "O":
                dest.variablesReference = this.getVarReference(line, dest.evaluateName + ":");
                var infos = value.split(" ")
                dest[valueName] = `CLASS ${infos[0]}`;
                dest.namedVariables = parseInt(infos[1]);
                break;
        }
        return dest;
    }

    sendVariables(id, line) {
        var vars = [];
        this.processLine = function (line) {
            if (line.startsWith("END")) {
                var resp = this.variables[id].response
                resp.body = {
                    variables: vars
                };
                this.sendResponse(resp);
                this.processLine = undefined;
                return;
            }
            var infos = line.split(":");
            if (infos[0] == "AREA") {
                // workareas
                // AREA:Alias:Area:fCount:recno:reccount:scope:
                //   0    1    2     3       4     5       6
                var value = "AREA " + infos[2];
                var v = new debugadapter.Variable(infos[1], value);
                v.indexedVariables = 4; //recno-recCount-Scope-Fields
                this.areasInfos[parseInt(infos[2])] = infos;
                //parseInt(infos[3])
                v.variablesReference = this.getVarReference("AREA" + infos[2], infos[1] + "->")
                //v = this.getVariableFormat(v,infos[5],infos[6],"value",line,id);
                vars.push(v);
                return
            }
            line = infos[0] + ":" + infos[1] + ":" + infos[2] + ":" + infos[3];
            if (infos.length > 7) { //the value can contains : , we need to rejoin it.
                infos[6] = infos.splice(6).join(":");
            }
            var v = new debugadapter.Variable(infos[4], infos[6]);
            v = this.getVariableFormat(v, infos[5], infos[6], "value", line, id);
            vars.push(v);
        }
    }

    /// PROGRAM FLOW
    continueRequest(response, args) {
        this.command("GO\r\n");
        this.sendResponse(response);
    }

    nextRequest(response, args) {
        this.command("NEXT\r\n");
        this.sendResponse(response);
    }

    stepInRequest(response, args) {
        this.command("STEP\r\n");
        this.sendResponse(response);
    }

    stepOutRequest(response, args) {
        this.command("EXIT\r\n");
        this.sendResponse(response);
    }

    pauseRequest(response, args) {
        this.command("PAUSE\r\n");
        this.sendResponse(response);
    }

    /// breakpoints
    setBreakPointsRequest(response, args) {
        var message = "";
        // prepare a response
        response.body = { "breakpoints": [] };
        response.body.breakpoints = [];
        response.body.breakpoints.length = args.breakpoints.length;
        // check if the source is already configurated for breakpoints
        var src = args.source.name.toLowerCase();
        var dest
        if (!(src in this.breakpoints)) {
            this.breakpoints[src] = {};
        }
        // mark all old breakpoints for deletion
        dest = this.breakpoints[src];
        for (var i in dest) {
            if (dest.hasOwnProperty(i)) {
                dest[i] = "-" + dest[i];
            }
        }
        // check current breakpoints
        dest.response = response;
        for (var i = 0; i < args.breakpoints.length; i++) {
            var breakpoint = args.breakpoints[i];
            response.body.breakpoints[i] = new debugadapter.Breakpoint(false, breakpoint.line);
            var thisBreakpoint = "BREAKPOINT\r\n"
            thisBreakpoint += `+:${src}:${breakpoint.line}`
            if ('condition' in breakpoint && breakpoint.condition.length > 0) {
                thisBreakpoint += `:?:${breakpoint.condition.replace(/:/g, ";")}`
            }
            if ('hitCondition' in breakpoint) {
                thisBreakpoint += `:C:${breakpoint.hitCondition}`
            }
            if ('logMessage' in breakpoint) {
                thisBreakpoint += `:L:${breakpoint.logMessage.replace(/:/g, ";")}`
            }
            if (dest.hasOwnProperty(breakpoint.line) && dest[breakpoint.line].substring(1) == thisBreakpoint) { // breakpoint already exists
                dest[breakpoint.line] = thisBreakpoint
                response.body.breakpoints[i].verified = true;
            } else {
                //require breakpoint
                message += thisBreakpoint + "\r\n"
                dest[breakpoint.line] = thisBreakpoint;
            }
        }
        // require delete old breakpoints
        var n1 = 0;
        for (var i in dest) {
            if (dest.hasOwnProperty(i) && i != "response") {
                if (dest[i].substring(0, 1) == "-") {
                    message += "BREAKPOINT\r\n"
                    message += `-:${src}:${i}\r\n`
                    dest[i] = "-";
                }
            }
        }
        this.checkBreakPoint(src);
        //this.sendEvent(new debugadapter.OutputEvent("send: "+message,"console"))
        this.command(message)
        //this.sendResponse(response)
    }

    processBreak(line) {
        //this.sendEvent(new debugadapter.OutputEvent("received: "+line+"\r\n","console"))
        var aInfos = line.split(":");
        var dest
        if (!(aInfos[1] in this.breakpoints)) {
            //error
            return
        }
        aInfos[2] = parseInt(aInfos[2]);
        aInfos[3] = parseInt(aInfos[3]);
        dest = this.breakpoints[aInfos[1]]
        var idBreak = dest.response.body.breakpoints.findIndex(b => b.line == aInfos[2]);
        if (idBreak == -1) {
            if (aInfos[2] in dest) {
                delete dest[aInfos[2]];
                this.checkBreakPoint(aInfos[1]);
            }
            return;
        }
        if (aInfos[3] > 1) {
            dest.response.body.breakpoints[idBreak].line = aInfos[3];
            dest.response.body.breakpoints[idBreak].verified = true;
            dest[aInfos[2]] = 1;
        } else {
            dest.response.body.breakpoints[idBreak].verified = false;
            if (aInfos[4] == 'notfound')
                dest.response.body.breakpoints[idBreak].message = localize('harbour.dbgNoModule')
            else
                dest.response.body.breakpoints[idBreak].message = localize('harbour.dbgNoLine')
            dest[aInfos[2]] = 1;
        }
        this.checkBreakPoint(aInfos[1]);
    }

    checkBreakPoint(src) {
        var dest = this.breakpoints[src];
        for (var i in dest) {
            if (dest.hasOwnProperty(i) && i != "response") {
                if (dest[i] != 1) {
                    return;
                }
            }
        }
        //this.sendEvent(new debugadapter.OutputEvent("Response "+src+"\r\n","console"))
        this.sendResponse(dest.response);
    }

    /// Exception / error
    setExceptionBreakPointsRequest(response, args) {
        var errorType = args.filters.length;
        // 0 - no stop on error
        // 1 - stop only out-of-sequence
        // 2 - stop all
        if (errorType == 1 && args.filters[0] != 'notSeq') {
            errorType++;
        }
        this.command(`ERRORTYPE\r\n${errorType}\r\n`)
        //TODO: list all possibile harbour exceptions
        /*response.body = {};
        response.body.breakpoints = [
          {id:0,message:"Unknown error"},
          {id:1,message:"Argument error"},
          {id:2,message:"Bound error"},
          {id:3,message:"String overflow"},
          {id:4,message:"Numeric overflow"},
          {id:5,message:"Zero divisor"},
          {id:6,message:"Numeric error"},
          {id:7,message:"Syntax error"},
          {id:8,message:"Operation too complex"},
          {id:11,message:"Memory low"},
          {id:12,message:"Undefined function"},
          {id:13,message:"No exported method"},
          {id:14,message:"Variable does not exist"},
          {id:15,message:"Alias does not exist"},
          {id:16,message:"No exported variable"},
          {id:17,message:"Illegal characters in alias"},
          {id:18,message:"Alias already in use"},
          {id:20,message:"Create error"},
          {id:21,message:"Open error"},
          {id:22,message:"Close error"},
          {id:23,message:"Read error"},
          {id:24,message:"Write error"},
          {id:25,message:"Print error"},
          {id:30,message:"Operation not supported"},
          {id:31,message:"Limit exceeded"},
          {id:32,message:"Corruption detected"},
          {id:33,message:"Data type error"},
          {id:34,message:"Data width error"},
          {id:35,message:"Workarea not in use"},
          {id:36,message:"Workarea not indexed"},
          {id:37,message:"Exclusive required"},
          {id:38,message:"Lock required"},
          {id:39,message:"Write not allowed"},
          {id:40,message:"Append lock failed"},
          {id:41,message:"Lock Failure"},
          {id:45,message:"Object destructor failure"},
          {id:46,message:"array access"},
          {id:47,message:"array assign"},
          {id:48,message:"array dimension"},
          {id:49,message:"not an array"},
          {id:50,message:"conditional"}
        ];*/
        this.sendResponse(response);
    }

    /// Evaluation
    evaluateRequest(response, args) {
        response.body = {};
        response.body.result = args.expression;
        this.evaluateResponses.push(response);
        this.command(`EXPRESSION\r\n${args.frameId + 1 || this.currentStack}:${args.expression.replace(/:/g, ";")}\r\n`)
    }

    /**
     * Evaluate the return from an expression request
     * @param line{string} the income line
     */
    processExpression(line) {
        // EXPRESSION:{frame}:{type}:{result}
        var infos = line.split(":");
        if (infos.length > 4) { //the value can contains : , we need to rejoin it.
            infos[3] = infos.splice(3).join(":");
        }
        var resp = this.evaluateResponses.shift();
        var line = "EXP:" + infos[1] + ":" + resp.body.result.replace(/:/g, ";") + ":";
        resp.body.name = resp.body.result
        if (infos[2] == "E") {
            resp.success = false;
            resp.message = infos[3];
        } else
            resp.body = this.getVariableFormat(resp.body, infos[2], infos[3], "result", line);
        this.sendResponse(resp);
    }

    /// Completition

    /**
     * @param response{DebugProtocol.CompletionsResponse}
     * @param args{DebugProtocol.CompletionsArguments}
     */
    completionsRequest(response, args) {
        this.completionsResponse = response;
        let completitonText = args.text.split(/[\r\n]{1,2}/);
        if (args.line) {
            completitonText = completitonText[args.line - 1];
        } else {
            completitonText = completitonText[0];
        }
        completitonText = completitonText.substring(0, args.column - 1);
        let lastWord = completitonText.match(/[\w\:]+$/i)
        if (lastWord) completitonText = lastWord[0];
        this.command(`COMPLETITION\r\n${args.frameId + 1 || this.currentStack}:${completitonText}\r\n`)
    }

    /**
     * @param line{string}
     */
    processCompletion() {
        this.processLine = function (line) {
            if (line == "END") {
                this.sendResponse(this.completionsResponse);
                this.processLine = undefined;
                return;
            }
            if (!this.completionsResponse.body) this.completionsResponse.body = {};
            if (!this.completionsResponse.body.targets) this.completionsResponse.body.targets = [];
            var type = line.substr(0, line.indexOf(":"));
            line = line.substr(line.indexOf(":") + 1);
            var thisCompletion = new debugadapter.CompletionItem(line, 0);
            thisCompletion.type = type == "F" ? 'function' :
                type == "M" ? 'field' :
                    type == "D" ? 'variable' : 'value';
            // function/procedure -> function
            // method -> field
            // data -> variable
            // local/public/etc -> value
            this.completionsResponse.body.targets.push(thisCompletion);
        }
    }
}


/// END
debugadapter.DebugSession.run(harbourDebugSession);
