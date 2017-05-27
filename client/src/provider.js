var vscode = require("vscode");
var fs = require("fs");
var lr = require("readline");

var procRegEx = /\s*((?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+([a-z_][a-z0-9_]*)\s*\(([^\)]*)\)/i;
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
	this.funcList = [];
	this.cMode = false;
}

/**
 * @param line{string}
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
	//console.log((this.cMode?"C":"H")+this.lineNr+">"+line);
	if(!this.cMode)
	{
		if(line.indexOf("pragma")>=0 && line.indexOf("BEGINDUMP")>=0)
		{
			this.cMode = true;
			return;
		}
		if(words[0].length>=4)
		{
			if(words[0].toLowerCase() == "procedure".substr(0,words[0].length)||
				(words.length>1 && words[1].toLowerCase() == "procedure".substr(0,words[1].length)))
			{
				var r = procRegEx.exec(line);
				if(r)
				{
					this.funcList.push(["procedure",r[2],this.startLine,this.lineNr,r[3]]);
				}
			}
			if(words[0].toLowerCase() == "function".substr(0,words[0].length)||
				(words.length>1 && words[1].toLowerCase() == "function".substr(0,words[1].length)))
			{
				var r = procRegEx.exec(line);
				if(r)
				{
					this.funcList.push(["function",r[2],this.startLine,this.lineNr,r[3]]);
				}
			}
		}
	} else
	{
		if(line.indexOf("pragma")>=0 && line.indexOf("ENDDUMP")>=0)
		{
			this.cMode = false;
			return;
		}
		if(line.indexOf("HB_FUNC")>=0)
		{
			var r = hb_funcRegEx.exec(line);
			if(r)
			{
				this.funcList.push(["c_function",r[1],this.startLine,this.lineNr,"?"]);
			}
		}
	}
}

Provider.prototype.parseFile = function(file,encoding)
{
	this.Clear();
	return new Promise((resolve,reject) =>
	{
		var reader = lr.createInterface({input:fs.createReadStream("/home/perry/Dropbox/test.prg","utf8")});
		reader.on("line",d => pp.parse(d));
		reader.on("close",() => {resolve(pp.funcList);})
	});
}

/**
 * @param document{vscode.TextDocument}
 * @param token{vscode.CancellationToken}
 */
Provider.prototype.provideDocumentSymbols = function(document, token)
{
	this.Clear();
	return new Promise((resolve,reject) => 
	{
		var lines=document.getText().split(/\r?\n/);
		for (var i = 0; i < lines.length; i++) 
		{
			this.parse(lines[i]);
		}
		var ret = [];
		for (var i = 0; i < this.funcList.length; i++) 
		{
			var func = this.funcList[i];
			ret.push(new vscode.SymbolInformation(func[1],11,"",
				new vscode.Location(document.uri,
					new vscode.Range(func[2],0,func[3],Number.MAX_VALUE))));
		}
		resolve(ret);
	});
}

//var pp = new Parser();
exports.Provider = Provider;

