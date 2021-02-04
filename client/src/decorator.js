const vscode = require('vscode');

// reuse the bracket-match style

var decoration;
/** @type{client.LanguageClient} */
var client;
function activate(context,_client)
{
	client=_client;
	decoration = vscode.window.createTextEditorDecorationType({
		borderStyle: 'solid',
		borderWidth: '1px',
		borderColor: new vscode.ThemeColor("editorBracketMatch.border"),
		backgroundColor: new vscode.ThemeColor("editorBracketMatch.background")
	});
	vscode.window.onDidChangeTextEditorSelection((e) => showGroups(e) );
}

function showGroups(evt)
{
	var section = vscode.workspace.getConfiguration('harbour');
	if(!section.decorator) return;

	var editor = evt.textEditor
	if(!editor) return;
	if(!editor.document) return;
	if(editor.document.languageId!="harbour") return;
	if(evt.selections.length!=1)
	{
		evt.textEditor.setDecorations(decoration, []);
		return;
	}
	var sel = evt.selections[0];
	client.sendRequest("harbour/groupAtPosition",{textDocument:{uri:editor.document.uri.toString()}, sel:sel}).then(ranges=>{
		var places = [];
		for (let k = 0; k < ranges.length; k++) {
			const rr = ranges[k];
			places.push({ range: new vscode.Range(rr.line,rr.startCol,rr.line,rr.endCol) });
		}

		evt.textEditor.setDecorations(decoration, places);
	})
}

exports.activate = activate;
