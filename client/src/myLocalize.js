var fs = require("fs");
var path = require('path');
var nls = require("vscode-nls");
var localize = nls.loadMessageBundle(); 

var messages;
function Init()
{
    reInit(JSON.parse(process.env.VSCODE_NLS_CONFIG));
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
    if(arg[0] in messages)
    {
        arg[0] = messages[arg[0]];
    } else
    {
        arg[0] = "Error: '" + arg[0] + "' not found";
    }
    arg.splice(0,0,null);
    return localize.apply(null, arg)
}

exports.reInit = reInit;
exports.localize = myLocalize;