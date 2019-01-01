var fs = require("fs");
var readline = require("readline");

var procRegEx = /\s*((?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+([a-z_][a-z0-9_]*)\s*(?:\(([^\)]*)\))?/i;
var methodRegEx = /\s*(meth(?:o(?:d)?)?)\s+(?:(?:(?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+)?([a-z_][a-z0-9_]*)\s*(?:\(([^\)]*)\))?(?:\s*class\s+([a-z_][a-z0-9_]*))?/i
var hb_funcRegEx = /HB_FUNC\s*\(\s*([A-Z0-9_]+)\s*\)/
function Provider()
{
	this.Clear();
}

Provider.prototype.Clear = function()
{
	this.comment=false;
	this.currLine = "";
	this.lineNr = -1;
	this.startLine = 0;
	this.lastCodeLine = 0;
	/** @type {array<Info>} */
	this.funcList = [];
	this.cMode = false;
	this.currentDocument = "";
	this.currentClass = undefined;
	this.currentMethod = undefined;
	this.currentComment = "";
	/** @type {Object.<string, Array<string>>} */
	this.databases={};
}

/**
 * @constructor
 * @param {string} name 
 * @param {string} kind 
 * @param {Info} parent 
 * @param {string} document 
 * @param {number} startLine 
 * @param {number} startCol 
 * @param {number} endLine 
 * @param {number} endCol
 * @param {string} [comment] 
 */
function Info(name,kind,parent,document,startLine,startCol,endLine,endCol,comment)
{
	/** @type {string} */
	this.name = name;
	/** @type {string} */
	this.kind = kind;
	/** @type {Info} */
	this.parent = parent;
	/** @type {string} */
	this.document = document;
	/** @type {number} */
	this.startLine = startLine;
	/** @type {number} */
	this.startCol = startCol;
	/** @type {number} */
	this.endLine = endLine;
	/** @type {number} */
	this.endCol = endCol;
	if(comment)
		this.comment = comment.substr(2);
}

/**
 * @param {string} name
 * @param {string} kind 
 * @param {Info} parent
 * @param {boolean=} search
 */
Provider.prototype.addInfo = function(name,kind,parent, search)
{
	if(search!==true) search=false;
	if(search)
	{
		var lines = this.currLine.split("\r\n");
		var rr = new RegExp('\\b'+name.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")+'\\b',"i")
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var m=rr.exec(line)
			if(m)
			{
				var ii = new Info(name,kind,parent,this.currentDocument,
					this.startLine+i,m.index,this.startLine+i,m.index+name.length, this.currentComment);
				this.currentComment=""
				this.funcList.push(ii);
				return ii;
			}			
		}
	}
	var ii = new Info(name,kind,parent,this.currentDocument,
		this.startLine,0,this.lineNr,1000, this.currentComment);
	this.currentComment=""
	this.funcList.push(ii);
	return ii;
}

Provider.prototype.linePP = function(line)
{
	this.lineNr++;
	if(this.comment)
	{
		var eC = line.indexOf("*/");
		if(eC==-1)
		{
			this.currentComment += "\r\n"+line;
			return;
		}
		this.currentComment += "\r\n" + line.substr(0,eC)
		line = line.substr(0,eC+2).replace(/[^\s]/g," ") + line.substr(eC+2);
		this.comment = false;
	}
	if(this.cont)
		this.currLine += "\r\n"+line;
	else
	{
		this.startLine = this.lineNr;
		this.currLine = line;
	}
	this.cont = line.endsWith(";") && !this.cMode;
}

Provider.prototype.linePrepare = function(line)
{
	var justStart = true, precJustStart=true;
	var precC = " ",c= " ";
	var string = "";
	if(this.currLine.trim().length == 0)
	{
		if(line.trim().length == 0)
			this.currentComment="";
		this.currLine="";
		return;
	}
	if(this.currLine.trim().match(/^NOTE\s/i))
	{
		this.currentComment += "\r\n"+this.currLine.trim().substr(4);
		this.currLine="";
		return;
	}
	for(var i=0;i<this.currLine.length;i++)
	{
		precC = c;
		precJustStart = justStart;
		c = this.currLine[i];
		if(justStart)
		{
			justStart = (precC==" "||precC=='\t');
		}
		// already in string
		if(string.length!=0)
		{
			if(c==string[0])
			{
				if(string=='"e' && precC=='\\')
					continue; // escaped " inside escaped string
				string = "";
			}
			continue;
		}
		// check code
		if(c=="*")
		{
			if(precC=="/")
			{
				var endC = this.currLine.indexOf("*/",i+1)
				if(endC>0)
				{
					this.currentComment="\r\n"+this.currLine.substr(i+1,endC-i-1)
					this.currLine = this.currLine.substr(0,i-1) + 
							" ".repeat(endC-i+3) +
							this.currLine.substr(endC+2);
					continue;
				} else
				{
					if(!justStart)
						this.currentComment=""
					this.currentComment+="\r\n"+this.currLine.substr(i+1)
					this.comment = true;
					this.currLine = this.currLine.substr(0,i-1)
					return;
				}
			}
			if(justStart)
			{
				// commented line: skip
				this.currentComment+="\r\n"+this.currLine.substr(i+1)
				this.currLine="";
				return;
			}
		}
		if((c=="/" && precC=="/")||(c=="&" && precC=="&"))
		{
			if(!precJustStart)
				this.currentComment=""
			this.currentComment+="\r\n"+this.currLine.substr(i+1)
			this.currLine = this.currLine.substr(0,i-1)
			return;
		}
		if(c=='"')
		{
			string=c;
			if(precC=="e")
			{
				string+='e';
			}
			continue;
		}
		if(c=="'")
		{
			string=c;
			continue;
		}
		if(c=="[")
		{
			if(/[a-zA-Z0-9_\[]/.test(precC))
				string="]";
			continue;
		}
	}
}

Provider.prototype.parseDeclareList = function(list,kind,parent)
{
	//list=list.join(" ");
	//console.log("-1:"+list);
	var i=-1;
	while(true)
	{
		i++;
		var filter=undefined;
		switch(i)
		{
			case 0: filter = /:=(?:[^,]|$)*/g; break; 		// Assegnation
			case 1: filter = /;\s*\r?\n/g; break;	//  New line
			case 2: filter = /'[^']*'/g; break;		// '' string
			case 3: filter = /"[^"]*"/g; break;		// "" string
			case 4: filter = /\[[^\[\]]*\]/g; break;	// [] string or array index
			case 5: filter = /{[^{}]*}/g; break;		// {} array declaration
			case 6: filter = /\([^\(\)]*\)/g; break;	// () couple
		}
		if (filter == undefined)
			break;
		do
		{
			var old= list;
			list=list.replace(filter,"")
		} while(old.length!=list.length)
		//console.log(i+":"+list);
	}
	list=list.split(",");
	//return list.split(",");
	if(list.length>1) this.currentComment = ""
	for (var i = 0; i < list.length; i++) 
	{
		var m = list[i].split(/\s+/).filter((el) => el.length!=0);
		if(m.length>0)
			this.addInfo(m[0],kind,parent,true);
	}
}

Provider.prototype.parseHarbour = function(words)
{
	if(this.currLine.indexOf("pragma")>=0 && this.currLine.indexOf("BEGINDUMP")>=0)
	// && /\^s*#pragma\s+BEGINDUMP\s*$/.test(this.currLine)
	{
		this.cMode = true;
		return;
	}
	var words1 = "";
	if(words.length>1)
	{
		words1 = words[1];
		words[1] = words[1].toLowerCase(); 
	} else
	{
		words[1] = "";
	}
	if(words[0].length>=4)
	{
		if((words[0] == "class") || (words[0]=="create" && words[1]=="class"))
		{
			if(this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
			if(words[0]=="create")
				this.currentClass = this.addInfo(words[2],'class')
			else
				this.currentClass = this.addInfo(words1,'class')
		} else
		if(words[0] == "endclass")
		{
			if(this.currentClass)
			{
				if(this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
				this.currentClass.endLine = this.lineNr;
			}
		} else
		if(words[0] == "data")
		{
			if(this.currentClass)
			{	
				this.parseDeclareList(words.slice(1).join(" "),'data',this.currentClass)
			}
		} else
		if(words[0] == "method".substr(0,words[0].length))
		{
			var r = methodRegEx.exec(this.currLine);
			if(r)
			{
				if(r[4] && r[4].length &&
					(this.currentClass && this.currentClass.name!=r[4]) || (!this.currentClass))
				{
					this.currentClass = this.funcList.find((v)=> v.name == r[4]);
				}
				if(this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
				this.currentMethod = this.addInfo(r[2],'method',this.currentClass);
				if(r[3] && r[3].length)
					this.parseDeclareList(r[3],"param",this.currentMethod);
			}
		} else
		if(	words[0] == "procedure".substr(0,words[0].length) ||
			words[0] == "function".substr(0,words[0].length) ||
			(
				(
					words[0] == "static".substr(0,words[0].length) ||
					words[0] == "init" ||
					words[0] == "exit"
				) &&
				words[1].length>=4 && 
				(
					words[1] == "procedure".substr(0,words[1].length) ||
					words[1] == "function".substr(0,words[1].length)
				)
			))
		{
			var r = procRegEx.exec(this.currLine);
			if(r)
			{
				var kind = r[1].startsWith('p')? "procedure" : "function";
				if(words[0].startsWith("stat")) kind+="*"; 
				if(this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
				this.currentMethod = this.addInfo(r[2],kind);
				if(r[3] && r[3].length)
					this.parseDeclareList(r[3],"param",this.currentMethod);

			}
		} else
		if(	words[0] == "local".substr(0,words[0].length) ||
			words[0] == "public".substr(0,words[0].length) ||
			words[0] == "private".substr(0,words[0].length) || 
			words[0] == "static".substr(0,words[0].length) ||
			words[0] == "memvar".substr(0,words[0].length) ||
			words[0] == "field".substr(0,words[0].length))
		{
			if(this.currentMethod || words[0].startsWith("stat") ||
				words[0].startsWith("memvar") || words[0].startsWith("field"))
			{
				var kind = "local";
				if(words[0].startsWith("publ")) kind = "public";
				if(words[0].startsWith("priv")) kind = "private";
				if(words[0].startsWith("stat")) kind = "static";
				if(words[0].startsWith("memv")) kind = "memvar";
				if(words[0].startsWith("fiel")) kind = "field";
				this.parseDeclareList(words.slice(1).join(" "),kind,this.currentMethod);
			}
		} //else
	}	
}

Provider.prototype.parseC = function(words)
{
	if(this.currLine.indexOf("pragma")>=0 && this.currLine.indexOf("ENDDUMP")>=0)
	// && /\^s*#pragma\s+ENDDUMP\s*$/.test(this.currLine)
	{
		this.cMode = false;
		return;
	}
	if(this.currLine.indexOf("HB_FUNC")>=0)
	{
		var r = hb_funcRegEx.exec(this.currLine);
		if(r)
		{
			this.addInfo(r[1],'C-FUNC');
		}
	}
}
/**
 * @param {string} line
 */
Provider.prototype.parse = function(line)
{
	this.linePP(line);
	if(this.comment || this.cont) return;
	this.linePrepare(line);
	if(this.currLine.trim().length==0) return;
	/** @type{string[]} */
	var words = this.currLine.split(/\s/).filter((el) => el.length!=0);
	if(words.length==0) return;
	words[0] = words[0].toLowerCase();
	//console.log((this.cMode?"C":"H")+this.lineNr+">"+this.currLine);
	if(!this.cMode)
	{
		this.findDBReferences();
		this.parseHarbour(words)
	} else
	{
		this.parseC(words)
	}
	this.lastCodeLine = this.lineNr;
}

Provider.prototype.parseString = function(txt,cMode)
{
	var providerThisContext = this;
	this.Clear();
	if(cMode != undefined)
		this.cMode = cMode;
	var lines = txt.split(/\r?\n/);
	for (var i = 0; i < lines.length; i++) {
		providerThisContext.parse(lines[i])
	}
	providerThisContext.endParse();
}

Provider.prototype.endParse = function()
{
	if(this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
}

Provider.prototype.parseFile = function(file,cMode,encoding)
{
	var providerThisContext = this;
	this.Clear();
	var startDoc = this.currentDocument;
	this.currentDocument = file;
	if(cMode != undefined)
		this.cMode = cMode;
	encoding = encoding || "utf8";
	return new Promise((resolve,reject) =>
	{
		var reader = readline.createInterface({input:fs.createReadStream(file,encoding)});
		reader.on("line",d => providerThisContext.parse(d));
		reader.on("close",() => 
		{
			providerThisContext.endParse();
			providerThisContext.currentDocument = startDoc;
			resolve(providerThisContext.funcList);
		})
	});
}

Provider.prototype.findDBReferences = function()
{
	var dbRegex = /([a-z0-9_]+|\((?:\([^\)]*\)|[^\)])+\))->([a-z0-9_]+)/gi
	var dbRef;
	while(dbRef = dbRegex.exec(this.currLine)) {
		dbRef[1] = dbRef[1].toLowerCase();
		dbRef[2] = dbRef[2].toLowerCase();
		if(dbRef[1]=='field') {
			this.addInfo(dbRef[2],"field",undefined,true);
		} else {
			if(!dbRef[1] in this.databases)	
				this.databases[dbRef[1]]=[];
			var i = this.databases[dbRef[1]].indexOf(dbRef[2]);
			if(i==0)
			{
				this.databases[dbRef[1]].push(dbRef[2]);
			}
		}
	}
}


Provider.prototype.GetLineAt = function(txt,pos)
{
	var lines = [];
	var posLineStart = pos
	while(txt[posLineStart]!="\n" && posLineStart>0) posLineStart--;
	if(txt[posLineStart]=="\n")	posLineStart+=1;
	var posLineEnd = pos;
	while(txt[posLineEnd]!="\n" && posLineEnd<txt.length-1) posLineEnd++;
	// go back until a line without ; found
	var curStart = posLineStart,curEnd;
	var line=";"
	while(line.indexOf(";")>=0 && curStart>0)
	{
		curEnd = curStart-1;
		curStart =  curEnd-1;
		while(txt[curStart]!="\n" && curStart>0) curStart--;
		if(txt[curStart]=="\n") curStart+=1;		
		line = txt.substring(curStart,curEnd)
		lines.splice(0,0,line)
	}
	// go forward until a line without ; found
	curStart = posLineStart;
	curEnd = posLineEnd;
	line = txt.substring(curStart,curEnd)
	lines.push(line)
	while(line.indexOf(";")>=0 && curEnd<txt.length-1)
	{
		curStart = curEnd+1;
		curEnd=curStart+1;
		while(txt[curEnd]!="\n" && curEnd<txt.length-1) curEnd++;
		line = txt.substring(curStart,curEnd)
		lines.push(line)	
	}
	for(var i=0;i<lines.length;i++)
	{
		var line = lines[i];
		this.linePP(line);
		if(this.comment || this.cont) contine;
		this.linePrepare();
		return this.currLine
	}
	return this.currLine
}

exports.Provider = Provider;

