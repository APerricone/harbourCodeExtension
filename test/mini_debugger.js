var net = require("net");

var port = 6110; //temp
var server = net.createServer(socket => {
	//connected!
	server.close();
	socket.on("data", data=> {
		console.log(data.toString());
		socket.write("STEP\r\n");
	});

	socket.on("close", () =>{
		console.log("end.")
		socket.end();
	});
	//while(!socket.destroyed)
	//{
	//	var r =  socket.read();
	//	while(r!=null)
	//	{
	//		console.log(r);
	//		r =  socket.read();
	//	}
	//	
	//};
}).listen(port,"127.0.0.1");
