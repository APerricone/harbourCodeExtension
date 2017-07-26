var debugadapter = require("vscode-debugadapter");
var debugprotocol = require("vscode-debugprotocol");
var net = require("net");
var path = require("path");
var cp = require("child_process");
/** @requires vscode-debugadapter   */
/// CLASS DEFINITION

/**
 * The debugger
 * @class
 */
var harbourDebugSession = function()
{
	/** @type{child_process.child_process} */
	this.process = null;
	/** @type{net.socket} */
	this.socket = null;
	/** @type{boolean} */
	this.Debbugging = true;
	this.workspaceRoot = "";
	/** @description the current process line function
	 * @type{function(string)} */
	this.processLine = undefined;
	this.breakpoints = {};
	/** @type{string[]} */
	this.variableCommands = [];
	/** @type{DebugProtocol.StackResponse} */
	this.stack = [];
	this.stackArgs = [];
	this.justStart = true;
	/** @type{string} */
	this.queue = "";
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
		//this.sendEvent(new debugadapter.OutputEvent(">>"+line+"\r\n","stdout"))
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
		if(line.startsWith("ERROR"))
		{
			//console.log("ERROR")
			this.sendEvent(new debugadapter.StoppedEvent("exception",1,line.substring(6)));
			continue;
		}
		if(line.startsWith("EXPRESSION"))
		{
			this.processExpression(line);
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
	response.body = response.body || {};
	response.body.supportsConfigurationDoneRequest = true;
	response.body.supportsDelayedStackTraceLoading = false;
	//response.body.supportsEvaluateForHovers = true; too risky
	this.sendResponse(response);
};

harbourDebugSession.prototype.configurationDoneRequest = function(response, args)
{
	if(this.startGO) this.command("GO\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.launchRequest = function(response, args)
{
	var port = 6110; //temp
	var tc=this;
	this.justStart = true;
	if("workspaceRoot" in args)
	{
		this.workspaceRoot = args.workspaceRoot + path.sep; 
	} else
	{
		this.workspaceRoot = path.dirname(args.program) + path.sep;
	}
	// starts the server
	var server = net.createServer(socket => {
		//connected!
		tc.sendEvent(new debugadapter.InitializedEvent());
		server.close();
		tc.socket = socket;
		socket.on("data", data=> {
			tc.processInput(data.toString())
		});
		socket.write(tc.queue);
		this.justStart = false;
		tc.queue = "";
	}).listen(port);
	// starts the program
	console.error("start the program");
	if(args.arguments)
		this.process = cp.spawn(args.program, args.arguments, { cwd:args.workingDir });
	else
		this.process = cp.spawn(args.program, { cwd:args.workingDir });

	this.process.on("exit",function(code)
	{
		//tc.sendEvent(new debugadapter.Event("exited",{"exitCode":code}));
		tc.sendEvent(new debugadapter.TerminatedEvent());
	});
	this.process.stderr.on('data', data => 
		tc.sendEvent(new debugadapter.OutputEvent(data.toString(),"stderr"))
	);
	this.process.stdout.on('data', data => 
		tc.sendEvent(new debugadapter.OutputEvent(data.toString(),"stdout"))
	);
	// is debugging?
	this.Debugging = !args.noDebug;
	this.startGo = args.stopOnEntry===false || args.noDebug===true;
	this.sendResponse(response);
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

harbourDebugSession.prototype.sendStack = function(line)
{
	var nStack = parseInt(line.substring(6));
	var frames = [];
	frames.length = nStack;
	var j=0;
	this.processLine = function(line)
	{
		var infos = line.split(":");
		frames[j] = new debugadapter.StackFrame(j,infos[2],
			new debugadapter.Source(infos[0],this.workspaceRoot+infos[0]),
			parseInt(infos[1]));
		j++;
		if(j==nStack)
		{
			var args = this.stackArgs.pop();
			var resp = this.stack.pop();
			args.startFrame = args.startFrame || 0;
			args.levels = args.levels || 100;
			args.levels += args.startFrame;
			resp.body = {
				stackFrames: frames.slice(args.startFrame, args.levels)
			};
			this.sendResponse(resp);
			this.processLine = undefined;
		}
	}
}

/// VARIABLES
harbourDebugSession.prototype.scopesRequest = function(response, args)
{
	// save wanted stack
	this.currentStack = args.frameId+1;
	// reset references
	this.variableCommands = ["LOCALS","PUBLICS","PRIVATES", "PRIVATE_CALLEE","STATICS"];
	//TODO: "GLOBALS","EXTERNALS"
	this.varResp = [];
	this.varResp.length = this.variableCommands.length;
	response.body = 
	{
		scopes:
		[
			new debugadapter.Scope("Local",1),
			new debugadapter.Scope("Public",2),
			new debugadapter.Scope("Private local",3),
			new debugadapter.Scope("Private external",4),
			new debugadapter.Scope("Statics",5),
			new debugadapter.Scope("Globals",6),
			new debugadapter.Scope("Externals",7)
		]
	};
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

harbourDebugSession.prototype.getVarReference = function(line)
{
	var r = this.variableCommands.indexOf(line);
	if(r>=0) return r+1;
	this.variableCommands.push(line)
	return this.variableCommands.length;
}

harbourDebugSession.prototype.getVariableFormat = function(dest,type,value,valueName,line)
{
	dest[valueName] = value;
	switch(type)
	{
		case "A":
			dest.variablesReference = this.getVarReference(line);
			dest[valueName] = `ARRAY(${value})`;
			dest.indexedVariables = parseInt(value);
			break;
		case "H":
			dest.variablesReference = this.getVarReference(line);
			dest[valueName] = `HASH(${value})`;
			dest.namedVariables = parseInt(value);
			break;
		case "O":
			dest.variablesReference = this.getVarReference(line);
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
		var v = new debugadapter.Variable(infos[4],infos[6],line);
		v = this.getVariableFormat(v,infos[5],infos[6],"value",line);
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
	response.body = {"breakpoints": []};
	response.body.breakpoints = [];
	response.body.breakpoints.length = args.breakpoints.length;
	//var src = args.source.path;
	//if(src.startsWith(this.workspaceRoot)) src = src.substring(this.workspaceRoot.length)
	var src = args.source.name;
	var dest
	if(!(src in this.breakpoints))
	{
		this.breakpoints[src] = {};
	}
	dest = this.breakpoints[src];
	for (var i in dest) {
		if (dest.hasOwnProperty(i)) {
			dest[i] = -1; // this indicates that it mus be deleted
		}
	}
	dest.response = response;
	for (var i = 0; i < args.breakpoints.length; i++) {
		var breakpoint = args.breakpoints[i];
		response.body.breakpoints[i] = new debugadapter.Breakpoint(false,breakpoint.line);
		if(dest.hasOwnProperty(breakpoint.line))
		{ // breakpoint already exists
			dest[breakpoint.line] = 1;
			response.body.breakpoints[i].verified = true;
		} else
		{
			message += "BREAKPOINT\r\n"
			message += `+:${src}:${breakpoint.line}\r\n`
			dest[breakpoint.line] = 0;
		}
	}
	var n1 = 0;
	for (var i in dest) {
		if (dest.hasOwnProperty(i) && i!="response") {
			if(dest[i]==-1)
			{
				message += "BREAKPOINT\r\n"
				message += `-:${src}:${i}\r\n`
				dest[i] = 0;
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
			dest.response.body.breakpoints[idBreak].message = "module not found"
		else
			dest.response.body.breakpoints[idBreak].message = "invalid line"		
		dest[aInfos[2]] = 1;
	} 
	this.checkBreakPoint(aInfos[1]);
}

harbourDebugSession.prototype.checkBreakPoint = function(src)
{
	var dest = this.breakpoints[src];
	for (var i in dest) {
		if (dest.hasOwnProperty(i) && i!="response") {
			if(dest[i]==0)
			{
				return; 
			}
		}
	}
	//this.sendEvent(new debugadapter.OutputEvent("Response "+src+"\r\n","console"))
	this.sendResponse(dest.response);
}

/// Evaluation

harbourDebugSession.prototype.evaluateRequest = function(response,args)
{
	this.evaluateResponse = response;
	this.evaluateResponse.body = {};
	this.evaluateResponse.body.result = args.expression; 
	this.command(`EXPRESSION\r\n${args.frameId+1 || this.currentStack}:${args.expression}\r\n`)	
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
	var line = "EXP:" + infos[1] + ":" + this.evaluateResponse.body.result + ":";
	this.evaluateResponse.body = 
		this.getVariableFormat(this.evaluateResponse.body,infos[2],infos[3],"result",line);
	this.sendResponse(this.evaluateResponse);	
}



/// END
debugadapter.DebugSession.run( harbourDebugSession);

