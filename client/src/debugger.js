const debugadapter = require("vscode-debugadapter");
const debugprotocol = require("vscode-debugprotocol");
const net = require("net");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const localize = require("./myLocalize.js").localize;
const process = require("process")
const trueCase = require("true-case-path")

/** @requires vscode-debugadapter   */
/// CLASS DEFINITION

/**
 * The debugger
 * @class
 */
var harbourDebugSession = function()
{
	/** @type{net.socket} */
	this.socket = null;
	/** @type{boolean} */
	this.Debbugging = true;
	this.sourcePaths = [];
	/** @description the current process line function
	 * @type{function(string)} */
	this.processLine = undefined;
	this.breakpoints = {};
	/** @type{string[]} */
	this.variableCommands = [];
	/** @type{string[]} */
	this.variableEvaluations = [];
	/** @type{DebugProtocol.StackResponse} */
	this.stack = [];
	this.stackArgs = [];
	this.justStart = true;
	/** @type{string} */
	this.queue = "";
	this.evaluateResponses = [];
	/** @type{DebugProtocol.CompletionsResponse} */
	this.completionsResponse = undefined;
}

harbourDebugSession.prototype = new debugadapter.DebugSession();

/**
 * process data from debugging process.
 * @param buff{string} the imported data
 */
harbourDebugSession.prototype.processInput = function(buff)
{
	var lines = buff.split("\r\n");
	for (var i = 0; i < lines.length; i++)
	{
		var line = lines[i];
		//if (!line.startsWith("LOG:")) this.sendEvent(new debugadapter.OutputEvent(">>"+line+"\r\n","stdout"))
		if(line.length==0) continue;
		if(this.processLine)
		{
			this.processLine(line);
			continue;
		}
		if(line.startsWith("STOP"))
		{
			this.sendEvent(new debugadapter.StoppedEvent(line.substring(5),1));
			continue;
		}
		if(line.startsWith("STACK"))
		{
			this.sendStack(line);
			continue;
		}
		if(line.startsWith("BREAK"))
		{
			this.processBreak(line);
			continue;
		}
		if(line.startsWith("ERROR") && !line.startsWith("ERROR_VAR"))
		{
			//console.log("ERROR")
			var stopEvt = new debugadapter.StoppedEvent("error",1,line.substring(6));
			this.sendEvent(stopEvt);
			continue;
		}
		if(line.startsWith("EXPRESSION"))
		{
			this.processExpression(line);
			continue;
		}
		if(line.startsWith("LOG"))
		{
			this.sendEvent(new debugadapter.OutputEvent(line.substring(4)+"\r\n","stdout"))
			continue;
		}
		if(line.startsWith("INERROR"))
		{
			this.sendScope(line[8]=='T')
			continue;
		}
		if(line.startsWith("COMPLETITION"))
		{
			this.processCompletion(line);
			continue;
		}
		for(var j=this.variableCommands.length-1;j>=0;j--)
		{
			if(line.startsWith(this.variableCommands[j]))
			{
				this.sendVariables(j,line);
				break;
			}
		}
		if(j!=this.variableCommands.length) continue;
	}
}

/// START

/**
 * @param response{debugprotocol.InitializeResponse}
 * @param args{debugprotocol.InitializeRequestArguments}
 */
harbourDebugSession.prototype.initializeRequest = function (response, args)
{
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
};

harbourDebugSession.prototype.configurationDoneRequest = function(response, args)
{
	if(this.startGo)
	{
		this.command("GO\r\n");
		this.sendEvent(new debugadapter.ContinuedEvent(1,true));
	}
	this.sendResponse(response);
}

harbourDebugSession.prototype.launchRequest = function(response, args)
{
	var port = args.port? args.port : 6110;
	var tc=this;
	this.justStart = true;
	this.sourcePaths = []; //[path.dirname(args.program)];
	if("workspaceRoot" in args) {
		this.sourcePaths.push(args.workspaceRoot);
	}
	if("sourcePaths" in args) {
		this.sourcePaths = this.sourcePaths.concat(args.sourcePaths);
	}
	for (let idx = 0; idx < this.sourcePaths.length; idx++) {
		try {
			this.sourcePaths[idx] = trueCase.trueCasePathSync(this.sourcePaths[idx]);
		} catch(ex) {
			// path no found
			this.sourcePaths.splice(idx,1);
			idx--;
		}
	}
	this.Debugging = !args.noDebug;
	this.startGo = args.stopOnEntry===false || args.noDebug===true;
	// starts the server
	var server = net.createServer(socket => {
		tc.evaluateClient(socket, server, args)
	}).listen(port);
	// starts the program
	//console.log("start the program");
	switch(args.terminalType)
	{
		case 'external':
		case 'integrated':
			this.runInTerminalRequest({
				"kind": args.terminalType,
				"cwd": args.workingDir,
				"args":  [args.program].concat(args.arguments? args.arguments : [])
			})
			break;
		case 'none':
		default:
			var process;
			if(args.arguments)
				process=cp.spawn(args.program, args.arguments, { cwd:args.workingDir });
			else
				process=cp.spawn(args.program, { cwd:args.workingDir });
			process.on("error", e =>
			{
				tc.sendEvent(new debugadapter.OutputEvent(localize("harbour.dbgError1",args.program,args.workingDir),"stderr"))
				tc.sendEvent(new debugadapter.TerminatedEvent());
				return
			})
			process.stderr.on('data', data =>
				tc.sendEvent(new debugadapter.OutputEvent(data.toString(),"stderr"))
			);
			process.stdout.on('data', data =>
				tc.sendEvent(new debugadapter.OutputEvent(data.toString(),"stdout"))
			);
			break;
	}
	this.sendResponse(response);
}

harbourDebugSession.prototype.attachRequest = function(response, args)
{
	var port = args.port? args.port : 6110;
	if(args.process<=0 && (args.program || "").length==0) {
		response.success = false;
		response.message = "invalid parameter";
		this.sendResponse(response);
		return;
	}
	var tc=this;
	this.justStart = true;
	this.sourcePaths = []; //[path.dirname(args.program)];
	if("workspaceRoot" in args) {
		this.sourcePaths.push(args.workspaceRoot);
	}
	if("sourcePaths" in args) {
		this.sourcePaths = this.sourcePaths.concat(args.sourcePaths);
	}
	for (let idx = 0; idx < this.sourcePaths.length; idx++) {
		try {
			this.sourcePaths[idx] = trueCase.trueCasePathSync(this.sourcePaths[idx]);
		} catch(ex) {
			// path no found
			this.sourcePaths.splice(idx,1);
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

harbourDebugSession.prototype.SetProcess = function(pid)
{
	var tc=this
	this.processId = pid;
	var interval = setInterval( ()=> {
		try
		{
			process.kill(pid,0);
		} catch(error)
		{
			tc.sendEvent(new debugadapter.TerminatedEvent());
			clearInterval(interval);
		}
	},1000)
}

harbourDebugSession.prototype.disconnectRequest = function(response, args)
{
	this.command("DISCONNECT\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.terminateRequest = function(response, args)
{
	process.kill(this.processId,'SIGKILL');
	this.sendResponse(response);
}

harbourDebugSession.prototype.evaluateClient = function(socket, server, args)
{
	var tc =this;

	socket.on("data", data=> {
		try {
			if(tc.socket==socket) {
				tc.processInput(data.toString())
				return;
			}
			// the client sended exe name and process ID
			var lines = data.toString().split("\r\n");
			if(lines.length<2)  {//todo: check if they arrive in 2 tranches.
				socket.write("NO\r\n")
				socket.end();
				return;
			}
			if(args.program && args.program.length>0) {
				var exeTarget = path.basename(args.program,path.extname(args.program)).toLowerCase();
				var clPath = path.basename(lines[0],path.extname(lines[0])).toLowerCase();
				if(clPath!=exeTarget)
				{
					socket.write("NO\r\n")
					socket.end();
					return;
				}
			}
			var processId = parseInt(lines[1]);
			if(args.process && args.process>0 && args.process!=processId) {
				socket.write("NO\r\n")
				socket.end();
				return;
			}
			socket.write("HELLO\r\n")
			tc.SetProcess(processId);
			//connected!
			tc.sendEvent(new debugadapter.InitializedEvent());
			server.close();
			tc.socket = socket;
			socket.removeAllListeners("data");
			socket.on("data", data=> {
				tc.processInput(data.toString())
			});
			socket.write(tc.queue);
			this.justStart = false;
			tc.queue = "";
		} catch(ex) {
			socket.write("NO\r\n")
			socket.end();
	}
	});
}

harbourDebugSession.prototype.command = function(cmd)
{
	if(this.justStart)
		this.queue += cmd;
	else
		this.socket.write(cmd);
}

/// STACK
/**
 * @param response{DebugProtocol.StackTraceResponse} response to send
 * @param args{DebugProtocol.StackTraceArguments} arguments
 */
harbourDebugSession.prototype.stackTraceRequest = function(response,args)
{
	if(this.stack.length==0)
		this.command("STACK\r\n");
	this.stack.push(response);
	this.stackArgs.push(args);
}

harbourDebugSession.prototype.threadsRequest = function(response)
{
	response.body =
	{
		threads:
		[ //TODO: suppport multi thread
			new debugadapter.Thread(1, "Main Thread")
		]
	};
	this.sendResponse(response)
}

harbourDebugSession.prototype.sendStack = function(line) {
	var nStack = parseInt(line.substring(6));
	var frames = [];
	frames.length = nStack;
	var j=0;
	this.processLine = function(line)
	{
		var infos = line.split(":");
		for(i=0;i<infos.length;i++) infos[i]=infos[i].replace(";",":")
		var completePath = infos[0]
		var found = false;
		if(infos[0].length>0) {
				if(path.isAbsolute(infos[0]) && fs.existsSync(infos[0])) {
					completePath = infos[0];
					found=true;
					try {
						completePath = trueCase.trueCasePathSync(infos[0]);
					} catch(ex) {}
				} else
				for(i=0;i<this.sourcePaths.length;i++) {
					if(fs.existsSync(path.join(this.sourcePaths[i],infos[0]))) {
						completePath = path.join(this.sourcePaths[i],infos[0]);
						found=true;
						try {
							completePath = trueCase.trueCasePathSync(infos[0],this.sourcePaths[i]);
						} catch(ex) {
							try {
								completePath = trueCase.trueCasePathSync(completePath);
							} catch(ex2) {}
						}
						break;
				}
				}
		}
		if(found) infos[0]=path.basename(completePath);
		frames[j] = new debugadapter.StackFrame(j,infos[2],
			new debugadapter.Source(infos[0],completePath),
			parseInt(infos[1]));
		j++;
		if(j==nStack)
		{
			while(this.stack.length>0)
			{
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
harbourDebugSession.prototype.scopesRequest = function(response, args)
{
	// save wanted stack
	this.currentStack = args.frameId+1;

	this.scopeResponse = response
	this.command("INERROR\r\n")
}

harbourDebugSession.prototype.sendScope = function(inError)
{
	// reset references
	this.variableCommands = [];
	if(inError)
		this.variableCommands.push("ERROR_VAR")
	this.variableCommands = this.variableCommands.concat(["LOCALS","PUBLICS","PRIVATES", "PRIVATE_CALLEE","STATICS"]);
	//TODO: "GLOBALS","EXTERNALS"
	this.varResp = [];
	this.varResp.length = this.variableCommands.length;
	this.variableEvaluations =  [];
	this.variableEvaluations.length = this.variableCommands.length;
	var n=0;
	var scopes = [];
	if(inError)
	{
		n=1;
		scopes.push(new debugadapter.Scope("Error",1))
	}
	scopes = scopes.concat([
		new debugadapter.Scope("Local",n+1),
		new debugadapter.Scope("Public",n+2),
		new debugadapter.Scope("Private local",n+3),
		new debugadapter.Scope("Private external",n+4),
		new debugadapter.Scope("Statics",n+5)
		//new debugadapter.Scope("Globals",6),
		//new debugadapter.Scope("Externals",7)
	])
	var response = this.scopeResponse;
	response.body =  { scopes: scopes };
	this.sendResponse(response)
}

harbourDebugSession.prototype.variablesRequest = function(response,args)
{
	var hbStart = args.start ? args.start+1 : 1;
	var hbCount = args.count ? args.count : 0;
	var prefix;
	if(args.variablesReference<=this.variableCommands.length)
	{
		this.varResp[args.variablesReference-1] = response;
		this.command(`${this.variableCommands[args.variablesReference-1]}\r\n`+
						  `${this.currentStack}:${hbStart}:${hbCount}\r\n`);
	} else
		this.sendResponse(response)
}

harbourDebugSession.prototype.getVarReference = function(line,eval)
{
	var r = this.variableCommands.indexOf(line);
	if(r>=0) return r+1;
	var infos = line.split(":");
	if(infos.length>4)
	{ //the value can contains : , we need to rejoin it.
		infos[2] = infos.splice(2).join(":").slice(0,-1);
		infos.length = 3;
		line = infos.join(":")+":"
	}
	this.variableCommands.push(line)
	this.variableEvaluations.push(eval)
	//this.sendEvent(new debugadapter.OutputEvent("added variable command:'"+line+"'\r\n","stdout"))
	return this.variableCommands.length;
}

harbourDebugSession.prototype.getVariableFormat = function(dest,type,value,valueName,line,id)
{
	if(type=="C")
	{
		value = value.replace(/\\\$\\n/g,"\n")
		value = value.replace(/\\\$\\r/g,"\r")
	}
	dest[valueName] = value;
	dest.type = type;
	if(["E","B","P"].indexOf(dest.type)==-1) {
		dest.evaluateName = "";
		if(this.variableEvaluations[id])
			dest.evaluateName = this.variableEvaluations[id];
		dest.evaluateName += dest.name;
		if(this.variableEvaluations[id] && this.variableEvaluations[id].endsWith("["))
			dest.evaluateName += "]";
	}
	switch(type)
	{
		case "A":
			dest.variablesReference = this.getVarReference(line,dest.evaluateName+"[");
			dest[valueName] = `ARRAY(${value})`;
			dest.indexedVariables = parseInt(value);
			break;
		case "H":
			dest.variablesReference = this.getVarReference(line,dest.evaluateName+"[");
			dest[valueName] = `HASH(${value})`;
			dest.namedVariables = parseInt(value);
			break;
		case "O":
			dest.variablesReference = this.getVarReference(line,dest.evaluateName+":");
			var infos = value.split(" ")
			dest[valueName] = `CLASS ${infos[0]}`;
			dest.namedVariables = parseInt(infos[1]);
			break;
	}
	return dest;
}

harbourDebugSession.prototype.sendVariables = function(id,line)
{
	var vars = [];
	this.processLine = function(line)
	{
		if(line.startsWith("END"))
		{
			this.varResp[id].body = {
				variables: vars
			};
			this.sendResponse(this.varResp[id]);
			this.processLine = undefined;
			return;
		}
		var infos = line.split(":");
		line = infos[0]+":"+infos[1]+":"+infos[2]+":"+infos[3];
		if(infos.length>7)
		{ //the value can contains : , we need to rejoin it.
			infos[6] = infos.splice(6).join(":");
		}
		var v = new debugadapter.Variable(infos[4],infos[6]);
		v = this.getVariableFormat(v,infos[5],infos[6],"value",line,id);
		vars.push(v);
	}
}

/// PROGRAM FLOW
harbourDebugSession.prototype.continueRequest = function(response, args)
{
	this.command("GO\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.nextRequest = function(response, args)
{
	this.command("NEXT\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.stepInRequest = function(response, args)
{
	this.command("STEP\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.stepOutRequest = function(response, args)
{
	this.command("EXIT\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.pauseRequest = function(response, args)
{
	this.command("PAUSE\r\n");
	this.sendResponse(response);
}

/// breakpoints
harbourDebugSession.prototype.setBreakPointsRequest = function(response,args)
{
	var message = "";
	// prepare a response
	response.body = {"breakpoints": []};
	response.body.breakpoints = [];
	response.body.breakpoints.length = args.breakpoints.length;
	// check if the source is already configurated for breakpoints
	var src = args.source.name.toLowerCase();
	var dest
	if(!(src in this.breakpoints))
	{
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
		response.body.breakpoints[i] = new debugadapter.Breakpoint(false,breakpoint.line);
		var thisBreakpoint = "BREAKPOINT\r\n"
		thisBreakpoint += `+:${src}:${breakpoint.line}`
		if('condition' in breakpoint && breakpoint.condition.length>0) {
			thisBreakpoint += `:?:${breakpoint.condition.replace(/:/g,";")}`
		}
		if('hitCondition' in breakpoint) {
			thisBreakpoint += `:C:${breakpoint.hitCondition}`
		}
		if('logMessage' in breakpoint) {
			thisBreakpoint += `:L:${breakpoint.logMessage.replace(/:/g,";")}`
		}
		if(dest.hasOwnProperty(breakpoint.line) &&  dest[breakpoint.line].substring(1)==thisBreakpoint)
		{ // breakpoint already exists
			dest[breakpoint.line] = thisBreakpoint
			response.body.breakpoints[i].verified = true;
		} else
		{
			//require breakpoint
			message += thisBreakpoint+"\r\n"
			dest[breakpoint.line] = thisBreakpoint;
		}
	}
	// require delete old breakpoints
	var n1 = 0;
	for (var i in dest) {
		if (dest.hasOwnProperty(i) && i!="response") {
			if(dest[i].substring(0,1)=="-")
			{
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

harbourDebugSession.prototype.processBreak = function(line)
{
	//this.sendEvent(new debugadapter.OutputEvent("received: "+line+"\r\n","console"))
	var aInfos = line.split(":");
	var dest
	if(!(aInfos[1] in this.breakpoints))
	{
		//error
		return
	}
	aInfos[2] = parseInt(aInfos[2]);
	aInfos[3] = parseInt(aInfos[3]);
	dest = this.breakpoints[aInfos[1]]
	var idBreak = dest.response.body.breakpoints.findIndex(b => b.line == aInfos[2]);
	if(idBreak==-1)
	{
		if(aInfos[2] in dest)
		{
			delete dest[aInfos[2]];
			this.checkBreakPoint(aInfos[1]);
		}
		return;
	}
	if(aInfos[3]>1)
	{
		dest.response.body.breakpoints[idBreak].line = aInfos[3];
		dest.response.body.breakpoints[idBreak].verified = true;
		dest[aInfos[2]] = 1;
	} else
	{
		dest.response.body.breakpoints[idBreak].verified = false;
		if(aInfos[4]=='notfound')
			dest.response.body.breakpoints[idBreak].message = localize('harbour.dbgNoModule')
		else
			dest.response.body.breakpoints[idBreak].message = localize('harbour.dbgNoLine')
		dest[aInfos[2]] = 1;
	}
	this.checkBreakPoint(aInfos[1]);
}

harbourDebugSession.prototype.checkBreakPoint = function(src)
{
	var dest = this.breakpoints[src];
	for (var i in dest) {
		if (dest.hasOwnProperty(i) && i!="response") {
			if(dest[i]!=1)
			{
				return;
			}
		}
	}
	//this.sendEvent(new debugadapter.OutputEvent("Response "+src+"\r\n","console"))
	this.sendResponse(dest.response);
}

/// Exception / error
harbourDebugSession.prototype.setExceptionBreakPointsRequest = function(response,args)
{
	var errorType = args.filters.length;
	// 0 - no stop on error
	// 1 - stop only ut-of-sequence
	// 2 - stop all
	if(errorType==1 && args.filters[0]!='notSeq')
	{
		errorType++;
	}
	this.command(`ERRORTYPE\r\n${errorType}\r\n`)
	this.sendResponse(response);
}

/// Evaluation

harbourDebugSession.prototype.evaluateRequest = function(response,args)
{
	response.body = {};
	response.body.result = args.expression;
	this.evaluateResponses.push(response);
	this.command(`EXPRESSION\r\n${args.frameId+1 || this.currentStack}:${args.expression.replace(/:/g,";")}\r\n`)
}

/**
 * Evaluate the return from an expression request
 * @param line{string} the income line
 */
harbourDebugSession.prototype.processExpression = function(line)
{
	// EXPRESSION:{frame}:{type}:{result}
	var infos = line.split(":");
	if(infos.length>4)
	{ //the value can contains : , we need to rejoin it.
		infos[3] = infos.splice(3).join(":");
	}
	var resp = this.evaluateResponses.shift();
	var line = "EXP:" + infos[1] + ":" + resp.body.result.replace(/:/g,";") + ":";
	resp.body.name = resp.body.result
	if(infos[2]=="E")
	{
		resp.success = false;
		resp.message = infos[3];
	} else
		resp.body = this.getVariableFormat(resp.body,infos[2],infos[3],"result",line);
	this.sendResponse(resp);
}

/// Completition

/**
 * @param response{DebugProtocol.CompletionsResponse}
 * @param args{DebugProtocol.CompletionsArguments}
 */
harbourDebugSession.prototype.completionsRequest = function(response, args)
{
	this.completionsResponse = response;
	this.command(`COMPLETITION\r\n${args.frameId+1 || this.currentStack}:${args.text}\r\n`)
}

/**
 * @param line{string}
 */
harbourDebugSession.prototype.processCompletion = function()
{
	this.processLine = function(line)
	{
		if(line == "END")
		{
			this.sendResponse(this.completionsResponse);
			this.processLine = undefined;
			return;
		}
		if(!this.completionsResponse.body) this.completionsResponse.body={};
		if(!this.completionsResponse.body.targets) this.completionsResponse.body.targets=[];
		var type = line.substr(0,line.indexOf(":"));
		line = line.substr(line.indexOf(":")+1);
		var thisCompletion = new debugadapter.CompletionItem(line,0);
		thisCompletion.type = type=="F"? 'function':
							  type=="M"? 'field' :
							  type=="D"? 'variable' : 'value';
		// function/procedure -> function
		// method -> field
		// data -> variable
		// local/public/etc -> value
		this.completionsResponse.body.targets.push(thisCompletion);
	}
}


/// END
debugadapter.DebugSession.run( harbourDebugSession);

