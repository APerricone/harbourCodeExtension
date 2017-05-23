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
	this.beakPoints = [];
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
		} else
		if(line.startsWith("STOP"))
		{
			this.sendEvent(new debugadapter.StoppedEvent("step",1));
			continue;
		} else
		if(line.startsWith("STACK"))
		{
			this.sendStack(line);
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
	//response.body.supportsEvaluateForHovers = true; I want it! :)
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
	this.process = cp.spawn(args.program,args.arguments);
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
		line = infos[0]+":"+infos[1]+":"+infos[2]+":"+infos[3]
		v = new debugadapter.Variable(infos[4],infos[6]);
		v.type = infos[5]
		switch(infos[5])
		{
			case "A":
				this.variableCommands.push(line)
				v.variablesReference = this.variableCommands.length;
				v.value = `ARRAY(${infos[6]})`;
				v.indexedVariables = infos[6];
				break;
			case "H":
				this.variableCommands.push(line)
				v.variablesReference = this.variableCommands.length;
				v.value = `HASH(${infos[6]})`;
				v.namedVariables = infos[6];
				break;
			//TODO: CLASSES
		}
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

/// BREAKPOINTS
harbourDebugSession.prototype.setBreakpointsRequest = function(response,args)
{
	var message = "";
	response.breakpoints.length = args.breakpoints.length;
	var req = {"response":response};
	var src = args.source.path;
	for (var i = 0; i < args.breakpoints.length; i++) {
		response.breakpoints[i] = new debugadapter.Breakpoint(false,breakpoint.line);
		response.breakpoints[i].id = -1;
		var breakpoint = args.breakpoints[i];
		message += "BREAKPOINT\r\n"
		message += `${src}:${breakpoint.line}`

	}
	this.sendResponse(response)
}

/// END
debugadapter.DebugSession.run( harbourDebugSession);

