var vscode = require('vscode');

// reuse the bracket-match style

var _DECORATION_OPTIONS = {
	stickiness: 1 /*NeverGrowsWhenTypingAtEdges*/,
	className: 'bracket-match'
};

var decoration;
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
}

function setDecorator(editor)
{
	if(!editor)
		return;
	var regEx = /\b(if|else|elseif|endif)\b/ig;
	var text = editor.document.getText();
	var places = [];
	var match;
	while (match = regEx.exec(text)) 
	{
		const startPos = editor.document.positionAt(match.index);
		const endPos = editor.document.positionAt(match.index + match[0].length);
		const decoration = { range: new vscode.Range(startPos, endPos) };
		places.push(decoration);
	}
	editor.setDecorations(decoration, places);
}

exports.activate = activate;
