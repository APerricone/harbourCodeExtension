var vscode = require('vscode');

// reuse the bracket-match style
var _DECORATION_OPTIONS = {
	stickiness: 1 /*NeverGrowsWhenTypingAtEdges*/,
	className: 'bracket-match'
};

function activate(context)
{
	vscode.window.onDidChangeActiveTextEditor(editor => 
	{
		editor.onDidChangeCursorPosition((e) => 
			{
				var t=e;
			});
	}, null, context.subscriptions);
}

exports.activate = activate;
