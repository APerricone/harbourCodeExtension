var vscode = require("vscode");
var fs = require("fs");
var lr = require("readline");

var procRegEx = /\s*((?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+([a-z_][a-z0-9_]*)\s*\(([^\)]*)\)/i;
var methodRegEx = /\s*(meth(?:o(?:d)?)?)\s+(?:(?:(?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+)?([a-z_][a-z0-9_]*)\s*\(([^\)]*)\)(?:\s*class\s+([a-z_][a-z0-9_]*))?/i
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
				this.funcList.push(new vscode.SymbolInformation(words[1],vscode.SymbolKind.Class,
					"",
					new vscode.Location(this.currentDocument,
						new vscode.Range(this.lineNr,0,this.lineNr,Number.MAX_VALUE))));

			}
			if(words[0] == "endclass")
			{
				var toChange = this.funcList.find( v => v.name == this.currentClass && v.kind == vscode.SymbolKind.Class);
				if(toChange)
				{
					toChange.location.range = new vscode.Range(toChange.location.range.start.line,0,this.lineNr,Number.MAX_VALUE);
					//toChange.location.range.end.line = this.lineNr;
				}
			}

			if(words[0] == "method".substr(0,words[0].length))
			{
				var r = methodRegEx.exec(line);
				if(r)
				{
					this.currentClass = r[4] || this.currentClass;
					this.funcList.push(new vscode.SymbolInformation(r[2],vscode.SymbolKind.Method,
						this.currentClass,
						new vscode.Location(this.currentDocument,
							new vscode.Range(this.startLine,0,this.lineNr,Number.MAX_VALUE))));
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
					this.funcList.push(new vscode.SymbolInformation(r[2],vscode.SymbolKind.Function,"",
						new vscode.Location(this.currentDocument,
							new vscode.Range(this.startLine,0,this.lineNr,Number.MAX_VALUE))));
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
				this.funcList.push(new vscode.SymbolInformation(r[1],vscode.SymbolKind.Function,"",
						new vscode.Location(this.currentDocument,
							new vscode.Range(this.lineNr,0,this.lineNr,Number.MAX_VALUE))));
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
		this.currentDocument = document.uri;
		var lines=document.getText().split(/\r?\n/);
		for (var i = 0; i < lines.length; i++) 
		{
			if(token.isCancellationRequested)
			{
				resolve(this.funcList);
				return;
			}	
			this.parse(lines[i]);
		}
		resolve(this.funcList);
	});
}

exports.Provider = Provider;

