var debugadapter = require("vscode-debugadapter");
var debugprotocol = require("vscode-debugprotocol");
var net = require("net");
var path = require("path");
var cp = require("child_process");

var variableCommands = ["LOCALS","PUBLICS","PRIVATES",
						"PRIVATE_CALLEE","STATICS"];
		//case 6: prefix = "GLOBALS"; break;
		//case 7: prefix = "EXTERNALS"; break;

var harbourDebugSession = function()
{
	this.stack = [];
	this.process = null;
	this.socket = null;
	this.Debbugging = true;
	this.workspaceRoot = "";
	this.processLine = undefined;
	this.varResp = [];
	this.varResp.length = variableCommands.length;
}

harbourDebugSession.prototype = new debugadapter.DebugSession();

harbourDebugSession.prototype.initializeRequest = function (response, args) 
{
	//response.body.supportsEvaluateForHovers = true; I want it! :)
	this.sendResponse(response);
};

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
		for(var j=0;j<variableCommands.length;j++)
		{
			if(line.startsWith(variableCommands[j]))
			{
				this.sendVariables(j,line,(j+1)*1000);
				break;
			}			
		}
		if(j!=variableCommands.length) continue;
	}
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

harbourDebugSession.prototype.sendVariables = function(id,line,refStart)
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
		v = new debugadapter.Variable(infos[2],infos[4]);
		v.type = infos[3]
		switch(infos[3])
		{
			case "A":
				v.variablesReference = refStart + infos[1];
				v.value = `ARRAY[${infos[4]}]`;
				v.indexedVariables = infos[4];
				break;
			case "H":
				v.variablesReference = refStart + infos[1];
				v.value = `HASH`;
				v.namedVariables = infos[4];
				break;
		}
		vars.push(v);		
	}
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
		//tc.sendEvent(new debugadapter.InitializedEvent());
		server.close();
		tc.socket = socket;
		socket.on("data", data=> {
			tc.processInput(data.toString())
		});
		if (args.stopOnEntry===false || args.noDebug===true)
			socket.write("GO\r\n");
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
	this.sendResponse(response);
}

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

harbourDebugSession.prototype.scopesRequest = function(response, args)
{
	this.currentStack = args.frameId+1;
	response.body = 
	{
		scopes:
		[ // TODO: made local,public,private for every stack line.
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
	if(args.variablesReference<=variableCommands.length)
	{
		this.varResp[args.variablesReference-1] = response;
		this.socket.write(`${variableCommands[args.variablesReference-1]}\r\n`+
						  `${this.currentStack}:${hbStart}:${hbCount}\r\n`);
	} else
		this.sendResponse(response)
}

debugadapter.DebugSession.run( harbourDebugSession);

