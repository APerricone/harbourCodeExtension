var vscode = require('vscode');

// reuse the bracket-match style

var decoration;
var groups;
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
		var substutute = "X";
		switch(i)
		{
			case 1: filter = /\/\/[^\r\n]*[\r\n]{1,2}/g; substutute = "C"; break;	 // // comments
			case 2: filter = /&&[^\r\n]*[\r\n]{1,2}/g; substutute = "C"; break;	 // && comments
			case 3: filter = /^\s*\*[^\r\n]*[\r\n]{1,2}/mg; substutute = "C"; break;	 // * comments			
			case 4: filter = /^\s*NOTE[^\r\n]*[\r\n]{1,2}/mg; substutute = "C"; break;	 // NOTE comments			
			case 5: filter = /\/\*(?!\*\/).*\*\//g; substutute = "C"; break; // /* */ comments
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
					return substutute.repeat(matchString.length-2)+"\r\n";
				if(matchString.endsWith("\n"))
					return substutute.repeat(matchString.length-1)+"\n";				
				if(matchString.endsWith("\r"))
					return substutute.repeat(matchString.length-1)+"\r";
                return substutute.repeat(matchString.length);
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
	if(!editor) return;
	if(!editor.document) return;
	if(editor.document.languageId!="harbour") return;
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.decorator)
		return;
			
	var regExs = [	/\b((if)|else(?:if)?|(end\s?if))\b/ig,
					/\b((for(?:\s+each)?)|loop|exit|(next))\b/ig,
					/\b((switch|do\s+case)|case|otherwise|default|exit|(end\s?switch|end\s?case))\b/ig,
					/\b(((?:do\s+)?while)|loop|exit|(end\s?do))\b/ig];
	var text = RemoveStringAndComments(editor.document.getText());
	var places = [];
	var match;
	groups = [];
	for (var i = 0; i < regExs.length; i++) {
		var stack = [];
		var currGroup = undefined;
		var regEx = regExs[i];
		while (match = regEx.exec(text)) 
		{
			const startPos = editor.document.positionAt(match.index);
			if(match[2])
			{
				if(currGroup)
					stack.push(currGroup)
				currGroup=[];
			}
			const endPos = editor.document.positionAt(match.index + match[0].length);
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
	for (var j = 0; j < groups.length; j++) {
		var gr = groups[j];
		for (var k = 0; k < groups[j].length; k++) {
			var rr = groups[j][k];
			if(rr.intersection(sel))
			{
				var places = [];
				for (k = 0; k < groups[j].length; k++)
					places.push({ range: groups[j][k] });
				evt.textEditor.setDecorations(decoration, places);
				return;
			}
		}
	}

	evt.textEditor.setDecorations(decoration, []);
}

exports.activate = activate;
