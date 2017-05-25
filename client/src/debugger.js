var debugadapter = require("vscode-debugadapter");
var debugprotocol = require("vscode-debugprotocol");
var net = require("net");
var path = require("path");
var cp = require("child_process");
/// CLASS DEFINITION
var harbourDebugSession = function()
{
	this.stack = [];
	this.process = null;
	this.socket = null;
	this.Debbugging = true;
	this.workspaceRoot = "";
	this.processLine = undefined;
	this.breakpoints = {};
	this.variableCommands = [];
}

harbourDebugSession.prototype = new debugadapter.DebugSession();

harbourDebugSession.prototype.processInput = function(buff)
{
	var lines = buff.split("\r\n");
	for (var i = 0; i < lines.length; i++)
	{
		var line = lines[i];
		if(line.length==0) continue;
		if(this.processLine)
		{
			this.processLine(line);
			continue;
		}
		if(line.startsWith("STOP"))
		{
			this.sendEvent(new debugadapter.StoppedEvent("step",1));
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
harbourDebugSession.prototype.initializeRequest = function (response, args) 
{
	response.body.supportsConfigurationDoneRequest = true;
	response.body.supportsEvaluateForHovers = true;
	this.sendResponse(response);
};

harbourDebugSession.prototype.configurationDoneRequest = function(response, args)
{
	if(this.startGO) this.socket.write("GO\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.launchRequest = function(response, args)
{
	var port = 6110; //temp
	var tc=this;
	if("workspaceRoot" in args)
	{
		this.workspaceRoot = args.workspaceRoot+"/"; 
	} else
	{
		this.workspaceRoot = path.dirname(args.program) + "/";
	}
	// starts the server
	var server = net.createServer(socket => {
		console.error("connected!")
		//connected!
		tc.sendEvent(new debugadapter.InitializedEvent());
		server.close();
		tc.socket = socket;
		socket.on("data", data=> {
			tc.processInput(data.toString())
		});
	}).listen(port);
	// starts the program
	console.error("start the program");
	this.process = cp.spawn(args.program,args.arguments, { cwd:args.workingDir });
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

/// STACK
harbourDebugSession.prototype.stackTraceRequest = function(response,args)
{
	this.socket.write("STACK\r\n");
	this.stack = response;
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
			this.stack.body = {
				stackFrames: frames
			};
			this.sendResponse(this.stack);
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
	this.variableCommands = ["LOCALS","PUBLICS","PRIVATES",
								"PRIVATE_CALLEE","STATICS"];
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
		this.socket.write(`${this.variableCommands[args.variablesReference-1]}\r\n`+
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
	this.socket.write("GO\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.nextRequest = function(response, args)
{
	this.socket.write("NEXT\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.stepInRequest = function(response, args)
{
	this.socket.write("STEP\r\n");
	this.sendResponse(response);
}

harbourDebugSession.prototype.stepOutRequest = function(response, args)
{
	this.socket.write("EXIT\r\n");
	this.sendResponse(response);
}

/// breakpoints
harbourDebugSession.prototype.setBreakPointsRequest = function(response,args)
{
	var message = "";
	response.breakpoints = [];
	response.breakpoints.length = args.breakpoints.length;
	var src = args.source.path;
	if(src.startsWith(this.workspaceRoot))
		src = src.substring(this.workspaceRoot.length)
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
		response.breakpoints[i] = new debugadapter.Breakpoint(false,breakpoint.line);
		if(dest.hasOwnProperty(breakpoint.line))
		{ // breakpoint already exists
			dest[breakpoint.line] = 1;
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
				message += `-:${src}:${breakpoint.line}\r\n`
				delete dest[i];
			}
		}
	}
	this.checkBreakPoint(src);
	this.socket.write(message)
	//this.sendResponse(response)
}

harbourDebugSession.prototype.processBreak = function(line)
{
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
	var idBreak = dest.response.breakpoints.findIndex(b => b.line == aInfos[2])
	if(idBreak==-1)
	{
		//error
		return;
	}
	if(aInfos[3]>1)
	{
		dest.response.breakpoints.line = aInfos[3];
		dest.response.breakpoints.verified = true;
	} else
	{
		dest.response.breakpoints.verified = false;
		dest.response.breakpoints.message = "invalid line"
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
	this.sendResponse(dest.response);
}

/// Evaluation

harbourDebugSession.prototype.evaluateRequest = function(response,args)
{
	this.evaluateResponse = response;
	this.evaluateResponse.body = {};
	this.evaluateResponse.body.result = args.expression; 
	this.socket.write("EXPRESSION\r\n"+args.expression+"\r\n")	
}

harbourDebugSession.prototype.processExpression = function(line)
{
	// EXPRESSION:{type}:{result}
	var infos = line.split(":");
	if(infos.length>3)
	{ //the value can contains : , we need to rejoin it.
		infos[2] = infos.splice(2).join(":");
	}
	var line = "EXP:"+this.evaluateResponse.body.result+"::";
	this.evaluateResponse.body = 
		this.getVariableFormat(this.evaluateResponse.body,infos[1],infos[2],"result",line);
	this.sendResponse(this.evaluateResponse);	
}



/// END
debugadapter.DebugSession.run( harbourDebugSession);

