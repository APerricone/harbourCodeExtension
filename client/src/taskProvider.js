// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

function activate() {
    var provider = {
        provideTasks: () => {
            let task = new vscode.Task({ type: "testTask" }, 'test task', "testTask", new vscode.ShellExecution(`echo src/extension.ts:10:13 - error TS2532: This does not seem to work.`));
            return [task];
		},
		resolveTask: (t) => undefined
	};
	vscode.tasks.registerTaskProvider("testTask", provider);
}

exports.activate = activate;
