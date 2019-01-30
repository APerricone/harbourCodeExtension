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
 * 
 * @param {String} txt 
 */
function removeMultilineComments(txt)
{
	var out = "";
	while(out.length!=txt.length)
	{
		var nextStart = txt.indexOf("/*",out.length);
		if(nextStart>0)
		{
			out += txt.substring(out.length,nextStart);
			var nextEnd = txt.indexOf("*/",out.length);
			if(nextEnd>0)
			{
				out+=txt.substring(out.length,nextEnd+2).replace(/[^\r\n]/g," ");
			} else
				break;
		} else break;
	}
	out+=txt.substring(out.length);
	return out;
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
	var regExs = [	/(?:^|;)\s*(#?(?:(if(?:n?def)?)|else(?:if)?|(end\s*if)))\b/igm,
					/(?:^|;)\s*((for(?:\s+each)?)|loop|exit|(next))\b/igm,
					/(?:^|;)\s*((switch|do\s+case)|case|otherwise|default|exit|(end\s*switch|end\s*case))\b/igm,
					/(?:^|;)\s*(((?:do\s*)?while)|loop|exit|(end\s*do))\b/igm,
					/(?:^|;)\s*((try)|catch|(end(?:\s+try)?))\b/igm,
					/(?:^|;)\s*((begin\s+sequence(?:\s+with)?)|recover|(end\s+sequence))\b/igm
				];
	//var text = RemoveStringAndComments(document.getText());
	var text = removeMultilineComments(document.getText());
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
			const startPos = document.positionAt(match.index + match[0].length-match[1].length);
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
