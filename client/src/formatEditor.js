const vscode = require('vscode');
const fs = require("fs");
const path = require('path');
const localize = require("./myLocalize.js").localize;

function escapeHTML(html) {
    html = html.replace(/&/g, "&amp;");
    html = html.replace(/</g, "&lt;");
    html = html.replace(/>/g, "&gt;");
    html = html.replace(/"/g, "&quot;");
    html = html.replace(/'/g, "&#039;");
    return html
}

/** @param {vscode.ExtensionContext} context  */
function showEditor(context) {
    const panel = vscode.window.createWebviewPanel(
        'harbourFmtEditor',
        localize('harbour.formatter.title'),
        vscode.ViewColumn.Active, {}
    );
    var package = JSON.parse(fs.readFileSync(path.join(context.extensionPath,"package.json"), 'utf8'))
    package = package.contributes.configuration.properties;
    var section = vscode.workspace.getConfiguration('harbour').formatter;
    // And set its HTML content
    const localResources = vscode.Uri.file(path.join(context.extensionPath,"formatter-settings"));
    const codiconsUri = vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist');
    panel.webview.options = {
        localResourceRoots: [localResources,codiconsUri],
        enableScripts: true
    }
    const baseUri = panel.webview.asWebviewUri(localResources);
    const cspSource = panel.webview.cspSource;
    var debug = typeof v8debug === 'object';
    var html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';
        font-src ${cspSource};
        style-src ${cspSource};
        script-src ${cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Coding</title>
    <link href="${panel.webview.asWebviewUri(codiconsUri)}/codicon.css" rel="stylesheet" />
    <link href="${baseUri}/style.css" rel="stylesheet" />
    <script src="${baseUri}/jquery-3.6.0${debug?"":".slim"}.min.js"></script>
    <script src="${baseUri}/code.js"></script>
    </head><body>`;

    for(let subZone in section) {
        let k0 = `harbour.formatter.${subZone}`;
        html += `<h1>${localize(k0)}</h1><div>`
        for(let zone in section[subZone]) {
            let cnf = section[subZone][zone];
            let k = k0+`.${zone}`;
            let cfg = package[k];
            html += `<label>`
            switch (cfg.type) {
                case "boolean":
                    html += `<input type="checkbox" id="${k}" class="config"`
                    if(cnf) html += " checked "
                    html += '>'+escapeHTML(localize(cfg.description));
                    break;
                case "string":
                    if("enum" in cfg) {
                        html += `${escapeHTML(localize(cfg.description))}<br><select id="${k}" class="config">`
                        for(let idx=0;idx<cfg.enum.length;++idx) {
                            /** @type {String} */
                            let v = cfg.enum[idx];
                            if(v.startsWith("use")) {
                                v = localize("harbour.formatter.enum.value.use",v.substring(4));
                            } else {
                                v = localize("harbour.formatter.enum.value."+v);
                            }
                            html += `<option value="${cfg.enum[idx]}"`
                            if(cnf==cfg.enum[idx]) html += " selected "
                            html += `>${escapeHTML(v)}</option>`
                        }
                        html += `</select>`
                    } else {
                        html += `<input></input>`
                    }
                    break;

                default:
                    break;
            }
            html += `</label>`
        }
        html += "</div>"
    }
    html += `<div id="preview"></div>`;
    html += `</body></html>`;
    panel.webview.onDidReceiveMessage((m)=> onEditorMessage(m));
    panel.webview.html =html;
}

function onEditorMessage(m) {
    switch (m.command) {
        case "currConfig":
            updateConfig(m.value)
            break;

        default:
            break;
    }
}

function updateConfig(readedValue) {
    var currValue = vscode.workspace.getConfiguration('harbour');
    var section = readedValue.formatter;
    for(let subZone in section) {
        let k0 = `formatter.${subZone}`;
        for(let zone in section[subZone]) {
            let k = k0+`.${zone}`;
            var ins = currValue.inspect(k);
            var rv = section[subZone][zone];
            if(rv==ins.defaultValue)
                currValue.update(k,undefined);
            else
                currValue.update(k,rv);
        }
    }
}

exports.showEditor = showEditor;
