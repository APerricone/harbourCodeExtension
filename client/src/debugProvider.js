const vscode = require('vscode');
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const localize = require("./myLocalize.js").localize;
const getAllWorkspaceFiles = require("./utils.js").getAllWorkspaceFiles;
const taskProvider = require('./taskProvider.js');

class HarbourDBGProvider {
    provideDebugConfigurations(folder,token) {
        return new getAllWorkspaceFiles(token).then((values)=>{
            var retValue = [{
                "type": "harbour-dbg",
                "request": "launch",
                "name": "Launch currentFile",
                "preLaunchTask": localize("harbour.task.HBMK2.provideName3")
            }];
            if(token.isCancellationRequested) {
                return;
            }
            for(let j=0;j<values.length;j++) {
                let ff = values[j];
                for(let i=0;i<ff.length;++i) {
                    if(!ff[i].isFile()) continue;
                    var ext = path.extname(ff[i].name).toLowerCase();
                    if(ext==".hbp") {
                        var debugInfo = {
                            "type": "harbour-dbg",
                            "request": "launch",
                            "name": "Launch currentFile",
                            "preLaunchTask": localize("harbour.task.HBMK2.provideName",path.basename(ff[i].name))
                        };
                        retValue.push(debugInfo);
                    }
                }
            }
            return retValue;
        });
    }

    resolveDebugConfiguration(folder, debugConfiguration, token) {
        /*
        var textDocument = {uri: {fsPath:""}};
        if(vscode && vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
            textDocument =vscode.window.activeTextEditor.document;
        var task = new vscode.Task({
                "type": "HBMK2",
                "input": "${file}",
                "debugSymbols": true,
                "output": "${fileBasenameNoExtension}_dbg"
            }, vscode.TaskScope.Global, localize("harbour.task.HBMK2.provideName3") ,"HBMK2");
        */
       return {
            "type": "harbour-dbg",
            "request": "launch",
            "name": "Launch currentFile",
            "preLaunchTask": localize("harbour.task.HBMK2.provideName3")
        };
    }
}

function activate() {
	vscode.debug.registerDebugConfigurationProvider("harbour-dbg", new HarbourDBGProvider());
}

exports.activate = activate;
