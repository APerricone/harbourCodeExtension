var vscode = require('vscode');

// reuse the bracket-match style

var decoration;
var editorGroups;
function activate(context)
{
	decoration = vscode.window.createTextEditorDecorationType({
		light: {
			border: 'solid 1px darkblue',
		},
		dark: {
			border: 'solid 1px lightblue',
		}
	});

	vscode.window.onDidChangeActiveTextEditor(editor => 
	{
		setDecorator(editor);
		/*if(!editor)
			return;
		editor.onDidChangeCursorPosition((e) => 
			{
				var t=e;
			});*/
	}, null, context.subscriptions);
	setDecorator(vscode.window.activeTextEditor);
	vscode.workspace.onDidChangeTextDocument(evt =>
	{
		if (evt.document.uri == vscode.window.activeTextEditor.document.uri) {
			setDecorator(vscode.window.activeTextEditor);
		}
	});
	vscode.window.onDidChangeTextEditorSelection((e) => showGroups(e) );
}

/**
 * Removes all strings an comments an replace them with XXXX of same length
 * @param {String} txt Text to parse
 */
function RemoveStringAndComments(txt)
{
    var  i=0;
	while(true)
	{
		i++;
		var filter=undefined;
		var substitute = "X";
		switch(i)
		{
			case 1: filter = /\/\/[^\r\n]*[\r\n]{1,2}/g; substitute = "C"; break;	 // // comments
			case 2: filter = /&&[^\r\n]*[\r\n]{1,2}/g; substitute = "C"; break;	 // && comments
			case 3: filter = /^\s*\*[^\r\n]*[\r\n]{1,2}/mg; substitute = "C"; break;	 // * comments			
			case 4: filter = /^\s*NOTE[^\r\n]*[\r\n]{1,2}/mg; substitute = "C"; break;	 // NOTE comments			
			case 5: filter = /\/\*(?!\*\/).*\*\//g; substitute = "C"; break; // /* */ comments
			case 6: filter = /'[^'\r\n]*'/g; break; // ' string
			case 7: filter = /"[^"\r\n]*"/g; break; // " string
			case 8: filter = /\[[^\]\r\n]*\]/g; break;  // [] string
			//case 9: filter = /#(if|else|endif)/g; break;  // precompiled if
		}
		if (filter == undefined)
			break;
		do
		{
            var someChange = false
            txt=txt.replace(filter, matchString =>
            {
				someChange = true;
				if(matchString.endsWith("\r\n"))
					return substitute.repeat(matchString.length-2)+"\r\n";
				if(matchString.endsWith("\n"))
					return substitute.repeat(matchString.length-1)+"\n";				
				if(matchString.endsWith("\r"))
					return substitute.repeat(matchString.length-1)+"\r";
                return substitute.repeat(matchString.length);
            })
		} while(someChange)
	}
	// Special cases, inline if in this form if(condition,truePart,falseParte)
	var inlineIf = /\bif\s*\(/gi;
	/** @type {RegExpMatchArray|undefined} */
	var mm;
	while(mm=inlineIf.exec(txt))
	{
		var i=mm.index + mm[0].length, nPar = 0, keepLooking = true, isInlineIf = false
		var precC,c="";
		while(keepLooking)
		{
			if(c!=' ' && c!='\t')
				precC=c
			c = txt.charAt(i)
			switch(c)
			{
				case '\r':
				case '\n':
					if (precC==';') // continue line
						c = ';' 
					else
						keepLooking = false; //new line, exit
					break;
				case ')':
					if(nPar==0)
						keepLooking = false; // end of backets, exit
					else
						nPar--; // closed a bracket
					break;
				case '(':
					nPar++; // open a bracket, in the condition
					break;
				case ',':
					if(nPar==0) // found a comma inside the brackets
					{
						isInlineIf = true; // it is an inline if
						keepLooking = false; // can exit
					}
					break
			}
			i++;
		}
		if(isInlineIf)
		{
			txt = txt.substring(0,mm.index) + "XX" + txt.substring(mm.index+2)
		}
	}
	return txt	
}

function setDecorator(editor)
{
	editorGroups = [];
	if(!editor) return;
	if(!editor.document) return;
	if(editor.document.languageId!="harbour") return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.decorator)
		return;
	editorGroups = GetGroups(editor.document);
}

function GetGroups(document)
{
	var groups=[];
	var regExs = [	/(?:\b|#)((if(?:n?def)?)|else(?:if)?|(end\s?if))\b/ig,
					/\b((for(?:\s+each)?)|loop|exit|(next))\b/ig,
					/\b((switch|do\s+case)|case|otherwise|default|exit|(end\s*switch|end\s*case))\b/ig,
					/\b(((?:do\s*)?while)|loop|exit|(end\s*do))\b/ig,
					/\b((try)|catch|(end(?:\s+try)?))\b/ig,
					/\b((begin\s+sequence(?:\s+with)?)|recover|(end\s+sequence))\b/ig
				];
	var text = RemoveStringAndComments(document.getText());
	var match;
	for (var i = 0; i < regExs.length; i++) {
		var stack = [];
		var currGroup = undefined;
		var regEx = regExs[i];
		while (match = regEx.exec(text)) 
		{
			if(match[2])
			{
				if(currGroup)
					stack.push(currGroup)
				currGroup=[];
				currGroup.name = match[2];
			}
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			if(currGroup)
				currGroup.push(new vscode.Range(startPos, endPos));
			if(match[3]) 
			{
				if(currGroup)
					groups.push(currGroup)
				if(stack.length>0)
					currGroup=stack.pop();
				else
					currGroup = undefined;
			};
		}
		if(currGroup)
			groups.push(currGroup)
	}
	return groups;
}

function showGroups(evt)
{
	if(evt.selections.length!=1)
	{
		evt.textEditor.setDecorations(decoration, []);
		return;
	}
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.decorator)
	{
		evt.textEditor.setDecorations(decoration, []);
		return;
	}
	var sel = evt.selections[0];
	for (var j = 0; j < editorGroups.length; j++) {
		var gr = editorGroups[j];
		for (var k = 0; k < editorGroups[j].length; k++) {
			var rr = editorGroups[j][k];
			if(rr.intersection(sel))
			{
				var places = [];
				for (k = 0; k < editorGroups[j].length; k++)
					places.push({ range: editorGroups[j][k] });
				evt.textEditor.setDecorations(decoration, places);
				return;
			}
		}
	}

		evt.textEditor.setDecorations(decoration, []);
}
/*
function HBProvider() {}

//document: TextDocument, context: FoldingContext, token: CancellationToken): ProviderResult<FoldingRange[]>
/**
 * @param {TextDocument} document
 * @param {FoldingContext} context 
 * @param {CancellationToken} token
 * @returns {ProviderResult<FoldingRange[]>}
 *//*
HBProvider.prototype.provideFoldingRanges = function(document, context, token)
{
	return new Promise(resolve => {
		var groups = GetGroups(document);
		if(token.isCancellationRequested) return resolve([]);
		var ranges = [];
		for (var j = 0; j < editorGroups.length; j++) {
			if(editorGroups[j].name.contains("if")) {
				for (var k = 1; k < editorGroups[j].length; k++) {
					var sf = editorGroups[j][k-1];
					var ef = editorGroups[j][k];
					ranges.push(new vscode.FoldingRange(sf.start.line,ef.start.line-1));
					if(token.isCancellationRequested) return resolve(ranges);
				}
			} else {
				var sf = editorGroups[j][0];
				var ef = editorGroups[j][editorGroups[j].length-1];
				ranges.push(new vscode.FoldingRange(sf.start.line,ef.start.line-1));
				if(token.isCancellationRequested) return resolve(ranges);
			}
		}
		resolve(ranges);
	});
}

exports.HBProvider = HBProvider;*/
exports.activate = activate;
