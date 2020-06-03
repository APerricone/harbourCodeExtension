const vscode = require('vscode');
const fs = require("fs");


/**
 *
 * @param {vscode.CancellationToken} token
 * @return {Promise<Array<Array<fs.Dirent>>>}
 */
function getAllWorkspaceFiles(token) {
    /** @type{Array<Promise>} */
    var promises = [];
    for(let d=0;d<vscode.workspace.workspaceFolders.length;d++) {
        let thisDir = vscode.workspace.workspaceFolders[d];
        /** @type {vscode.Uri} */
        var uri = vscode.Uri.parse(thisDir.uri)
        if (uri.scheme != "file") continue;
        //var r = promisify();
        var r = new Promise((res,reject)=>{
            if(token.isCancellationRequested) {
                reject(token);
                return;
            }
            fs.readdir(uri.fsPath, {withFileTypes: true},(err,ff)=>{
                if(token.isCancellationRequested) {
                    reject(token);
                    return;
                }
                res(ff);
            })
        });
        promises.push(r);
    }
    return Promise.all(promises);
}

exports.getAllWorkspaceFiles = getAllWorkspaceFiles;