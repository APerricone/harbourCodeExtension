var debugadapter = require("vscode-debugadapter");
var debugprotocol = require("vscode-debugprotocol");
var net = require("net");
var path = require("path");
var cp = require("child_process");

var harbourDebugSession = function()
{
	this.stack = [];
	this.process = null;
	this.socket = null;
	this.Debbugging = true;
	this.workspaceRoot = "";
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
		if(line.startsWith("STOP"))
		{
			this.sendEvent(new debugadapter.StoppedEvent("step",1));		
			continue;
		}
		if(line.startsWith("STACK"))
		{
			var nStack = parseInt(line.substring(6));
			var frames = [];
			frames.length = nStack;
			for (var j = 0; j < nStack; j++)
			{	
				var line = lines[++i];
				var infos = line.split(":");
				frames[j] = new debugadapter.StackFrame(j,infos[2],
					new debugadapter.Source(infos[0],this.workspaceRoot+infos[0]),
					parseInt(infos[1]))
			}
			this.stack.body = {
				stackFrames: frames
			};
			this.sendResponse(this.stack);
		}
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
		tc.sendEvent(new TerminatedEvent());
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

debugadapter.DebugSession.run( harbourDebugSession);

