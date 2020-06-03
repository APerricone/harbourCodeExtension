const fs = require("fs");
const path = require('path');
const localize = require("vscode-nls").loadMessageBundle();

var messages;
function Init()
{
    if(process.env.VSCODE_NLS_CONFIG)
        reInit(JSON.parse(process.env.VSCODE_NLS_CONFIG));
    else
        reInit("");
}
Init();
function reInit(config)
{
    try
    {
        messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, path.join('..',"package.nls."+config.locale+".json")), 'utf8'));
    }
    catch (error) {
        messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, path.join('..',"package.nls.json")), 'utf8'));
    }
}

function myLocalize()
{
    var arg = Array.prototype.slice.call(arguments);
    if(arg[0] in messages) {
        arg[0] = messages[arg[0]];
    } else {
        arg[0] = "Error: '" + arg[0] + "' not found";
    }
    arg.splice(0,0,null);
    return localize.apply(null, arg)
}

exports.reInit = reInit;
exports.localize = myLocalize;