var fs = require("fs");
var readline = require("readline");

var procRegEx = /\s*((?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+([a-z_][a-z0-9_]*)\s*\(([^\)]*)\)/i;
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
	//** @type{array} */
	this.funcList = [];
	this.cMode = false;
	this.currentDocument = "";
	this.currentClass = "";
	this.currentMethod = "";
}

/**
 * @constructor
 * @param {string} name 
 * @param {string} kind 
 * @param {string} parent 
 * @param {string} document 
 * @param {number} startLine 
 * @param {number} startCol 
 * @param {number} endLine 
 * @param {number} endCol 
 */
function Info(name,kind,parent,document,startLine,startCol,endLine,endCol)
{
	this.name = name;
	this.kind = kind;
	this.parent = parent;
	this.document = document;
	this.startLine = startLine;
	this.startCol = startCol;
	this.endLine = endLine;
	this.endCol = endCol;
}

/**
 * @param {string} line
 */
Provider.prototype.parse = function(line)
{
	this.lineNr++;
	if(this.comment)
	{
		var eC = line.indexOf("*/");
		if(eC==-1) return;
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
	if(this.cont) return;
	line = this.currLine;
	var justStart = true;
	var precC = "",c;
	var string = "";
	if(line.trim().match(/^NOTE\s/i) || line.trim().length == 0)
	{
		return;
	}
	for(var i=0;i<line.length;i++)
	{
		precC = c;
		c = line[i];
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
				var endC = line.indexOf("*/",i+1)
				if(endC>0)
				{
					line = line.substr(0,i-1) + 
							" ".repeat(endC-i+3) +
							line.substr(endC+2);
					continue;
				} else
				{
					this.comment = true;
					line = line.substr(0,i-1)
					break;
				}
			}
			if(justStart)
			{
				// commented line: skip
				return;
			}
		}
		if((c=="/" && precC=="/")||(c=="&" && precC=="&"))
		{
			line = line.substr(0,i-1)
			break;
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
			if(/[a-zA-Z0-9_]/.test(precC))
				string="]";
			continue;
		}
	}

	if(line.trim().length==0) return;
	/** @type{string[]} */
	var words = line.split(/\s/).filter((el) => el.length!=0);
	if(words.length==0) return;
	words[0] = words[0].toLowerCase();
	if(words.length>1) words[1] = words[1].toLowerCase(); else words[1] = "";
	//console.log((this.cMode?"C":"H")+this.lineNr+">"+line);
	if(!this.cMode)
	{
		if(line.indexOf("pragma")>=0 && line.indexOf("BEGINDUMP")>=0)
		// && /\^s*#pragma\s+BEGINDUMP\s*$/.test(line)
		{
			this.cMode = true;
			return;
		}
		if(words[0].length>=4)
		{
			if(words[0] == "class")
			{
				this.currentClass = words[1];
				this.funcList.push(new Info(words[1],'class','',this.currentDocument,
						this.lineNr,0,this.lineNr,1000));
			}
			if(words[0] == "endclass")
			{
				var toChange = this.funcList.find( v => v.name == this.currentClass && v.kind == 'class');
				if(toChange)
				{
					toChange.endLine = this.lineNr;
				}
			}

			if(words[0] == "method".substr(0,words[0].length))
			{
				var r = methodRegEx.exec(line);
				if(r)
				{
					this.currentClass = r[4] || this.currentClass;
					this.funcList.push(new Info(r[2],'method',this.currentClass,this.currentDocument,
						this.startLine,0,this.lineNr,1000));
				}
			} else
			if(	words[0] == "procedure".substr(0,words[0].length) ||
				words[1] == "procedure".substr(0,words[1].length) ||
				words[0] == "function".substr(0,words[0].length) ||
				words[1] == "function".substr(0,words[1].length) )
			{
				var r = procRegEx.exec(line);
				if(r)
				{
					var kind = r[1].startsWith('p')? "procedure" : "function";
					this.funcList.push(new Info(r[2],kind,"",this.currentDocument,
						this.startLine,0,this.lineNr,1000));
				}
			} 
		}
	} else
	{
		if(line.indexOf("pragma")>=0 && line.indexOf("ENDDUMP")>=0)
		// && /\^s*#pragma\s+ENDDUMP\s*$/.test(line)
		{
			this.cMode = false;
			return;
		}
		if(line.indexOf("HB_FUNC")>=0)
		{
			var r = hb_funcRegEx.exec(line);
			if(r)
			{
				this.funcList.push(new Info(r[1],"C-FUNC","",this.currentDocument,
							this.lineNr,0,this.lineNr,1000));
			}
		}
	}
}

Provider.prototype.parseFile = function(file,encoding)
{
	var providerThisContext = this;
	this.Clear();
	encoding = encoding || "utf8";
	return new Promise((resolve,reject) =>
	{
		var reader = readline.createInterface({input:fs.createReadStream(file,encoding)});
		reader.on("line",d => providerThisContext.parse(d));
		reader.on("close",() => {resolve(providerThisContext.funcList);})
	});
}

exports.Provider = Provider;

