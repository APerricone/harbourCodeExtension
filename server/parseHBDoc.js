var fs = require("fs");
var readline = require("readline");
var path = require("path")

//var hbPath = "/home/perry/harbour-src"
var hbPath = "c:\\harbour"
//parseDocEn(path.join(hbPath,"doc","en")); // parsed 332 procedures (over 1579 standard)
parseDocEn(hbPath); //parsed 833 procedures (over 1579 standard)
//parseDocEn("c:\\harbour\\contrib\\rddads\\doc\\en")
parseHBX(path.join(hbPath,"include","harbour.hbx"));

var nTodo = 0;
var docs = [];
var stdMethods = [];
function parseDocEn(dir) {
	console.debug(`listing: ${dir}...`)
	fs.readdir(dir, function (err, ff) {
		if (ff == undefined)
			return;
		for (var i = 0; i < ff.length; i++) {
			let completePath = path.join(dir, ff[i]);
			let info = fs.statSync(completePath);
			if(ff[i].toLocaleLowerCase().endsWith(".txt")) {
				new parseFile(completePath);
			} else if(info.isDirectory()) {
				parseDocEn(completePath)
			}
		}
	});
}

function parseHBX(path)
{
	nTodo++;
	var ck = /DYNAMIC\s+([_a-z0-9]+)/i;
	var reader = readline.createInterface({input:fs.createReadStream(path,"utf8")});
	reader.on("line",l =>
	{
		var m = l.match(ck);
		if(m && m[1])
		{
			stdMethods.push(m[1]);
		}
	});
	reader.on("close",() =>
	{
		nTodo--;
		if(nTodo==0)
			createDoc();
	})
}
function parseFile(path)
{
	//console.debug(`parsing: ${path}...`)
	nTodo++;
	this.inDoc = false;
	this.lastSpecifyLine = ""
	this.nFound = 0
	this.reader = readline.createInterface({input:fs.createReadStream(path,"utf8")});
	this.reader.on("line",l => this.parseLine(l));
	this.reader.on("close",() =>
	{
		if(this.nFound>0)
			console.debug(`${path}: found ${this.nFound} doc...`)
		nTodo--;
		if(nTodo==0)
			createDoc();
	})
}

function createDoc()
{
	console.debug(`parsed ${docs.length} procedures (over ${stdMethods.length} standard)`)
	docs.sort( (a,b) => a.name.localeCompare(b.name));
	stdMethods.sort( (a,b) => a.localeCompare(b));
	var unDoc = [], extra = [];
	var is = 0, id =0;
	while(is<stdMethods.length && id<docs.length)
	{
		switch(stdMethods[is].localeCompare(docs[id].name))
		{
			case  0: id++; is++; break; //are the same, go ahead both
			case -1: unDoc.push(stdMethods[is]); is++; break; // Cathed! undocumentated method.
			case 1: extra.push(docs[id].label); id++; break; // I don't write it anywhere, but extra contains documentated proc absent in hbx
		}
	}
	var msg = "standard un documentated methods:\r\n"
	for(var i=0;i<unDoc.length;i++)
		msg += unDoc[i]+"\r\n";

	fs.writeFile("src/hbdocs.missing",	msg, (err)=>{if(err) console.error(err);});
	fs.writeFile("src/hbdocs.json",	JSON.stringify(docs,undefined,1),(err)=>{if(err) console.error(err);});
}

/**
 * @param {String} line
 */
parseFile.prototype.parseLine = function(line)
{
	line = line.trim()
	if(!this.inDoc)
	{
		this.inDoc = line == "/* $DOC$";
		if(this.inDoc){
			this.nFound++;
			this.doc = {};
			this.doc["label"] = undefined;
			this.doc["documentation"] = undefined;
			this.doc["arguments"] = [];
		}
		return
	}
	if(line == "*/")
	{
		if(this.doc && this.doc.label)
			docs.push(this.doc);
		this.doc = undefined;
		this.inDoc = false;
		return;
	}
	if(line.startsWith("$"))
	{
		this.lastSpecifyLine = line;
		return
	}
	switch(this.lastSpecifyLine)
	{
		case "$TEMPLATE$":
			this.currentTemplate = line;
			break;
		case "$ONELINER$":
			if(this.doc)
			{
				if(this.doc["documentation"])
					this.doc["documentation"] += " " +line;
				else
					this.doc["documentation"] = line;
			}
			break;
		case "$SYNTAX$":
			if(this.doc)
			{
				if(line == "C Prototype")
					this.doc = undefined;
				else
				if(this.doc["label"])
					this.doc["label"] += " " + line;
				else
				{
					var p = line.indexOf("(");
					if(p<0)
					{
						this.doc = undefined;
						break;
					}
					var name = line.substring(0,p)
					if(name.indexOf(" ")>0)
					{
						this.doc = undefined;
						break;
					}
					this.doc["name"] = name;
					this.doc["label"] = line;
				}
			}
			break;
		case "$ARGUMENTS$":
			if(this.doc && line.length>0) {
				var ck = /^\s*<[^>]+>/;
				var mm = line.match(ck);
				if(mm) {
					var arg = {label:mm[0],documentation: line.replace(mm[0],"").trim()};
					this.doc.arguments.push(arg);
				}else if(this.doc.arguments.length>0)
					this.doc.arguments[this.doc.arguments.length-1].documentation += " " + line;
			}
			break;
		case "$RETURNS$":
			if(this.doc && line.length>0) {
				var ck = /^\s*<[^>]+>/;
				var mm = line.match(ck);
				if(mm) {
					if(this.doc.return) {
						this.doc.return.help += " " + line;
					} else {
						var arg = {name:mm[0], help: line.replace(mm[0],"").trim()};
						this.doc.return = arg;
					}
				} else {
					if(this.doc.return) {
						this.doc.return.help += " " + line;
					} else
						this.doc.return = {name:"", help: line};

				}
			}
			break;
	}
	/* templates:
		Document
		Function
		Command
		Procedure
		Run time error
		Class
	*/
}
