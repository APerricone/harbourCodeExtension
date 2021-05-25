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
    const localResources = vscode.Uri.file(path.join(context.extensionPath,"formatter-settings"));
    const panel = vscode.window.createWebviewPanel(
        'harbourFmtEdito',
        localize('harbour.formatter.title'),
        vscode.ViewColumn.Active, {}
    );
    var package = JSON.parse(fs.readFileSync(path.join(context.extensionPath,"package.json"), 'utf8'))
    package = package.contributes.configuration.properties;
    var section = vscode.workspace.getConfiguration('harbour').formatter;
    // And set its HTML content
    panel.webview.options = {
        localResourceRoots: [localResources],
        enableScripts: true
    }
    const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'formatter-settings', 'codicon.css'));
    const codiconsFontUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'formatter-settings', 'codicon.ttf'));
    const baseUri = panel.webview.asWebviewUri(localResources);
    const cspSource = panel.webview.cspSource;
    var debug = typeof v8debug === 'object';
    var html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none';
            img-src ${cspSource} data:;
            font-src ${cspSource};
            script-src ${cspSource};
            style-src ${cspSource} 'self' 'unsafe-inline';" />
        <link rel="stylesheet" href="${baseUri}/style.css">
        <link rel="stylesheet" href="${codiconsUri}"  />
        <script src="${baseUri}/jquery-3.6.0${debug?"":".slim"}.min.js"></script>
        <script src="${baseUri}/code.js"></script>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none';
            font-src ${codiconsFontUri}; style-src ${panel.webview.cspSource} ${codiconsUri};">

        <meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>`;
    for(let subZone in section) {
        html += `<h1>${subZone}</h1><div>`
        for(let zone in section[subZone]) {
            let cnf = section[subZone][zone];
            let k = `harbour.formatter.${subZone}.${zone}`;
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
                            html += `<option`
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
    panel.webview.html =html;
}

exports.showEditor = showEditor;
