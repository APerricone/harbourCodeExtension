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

function setDecorator(editor)
{
	if(!editor)
		return;
	var regExs = [	/\b((if)|else|elseif|(endif))\b/ig,
					/\b((for(?:\s+each)?)|loop|exit|(next))\b/ig,
					/\b((switch|do\s+case)|case|otherwise|exit|(endswitch|endcase))\b/ig,
					/\b((do\s+while)|loop|exit|(enddo))\b/ig];
	var text = editor.document.getText();
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
		evt.textEditor.setDecorations(decoration, []);

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
