const { KeyObject } = require("crypto");
const fs = require("fs");
const path = require('path');
const localize = require("vscode-nls").loadMessageBundle();

var messages,messagesFall;
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
        messagesFall = JSON.parse(fs.readFileSync(path.resolve(__dirname, path.join('..',"package.nls.json")), 'utf8'));
    }
    catch (error) {
        messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, path.join('..',"package.nls.json")), 'utf8'));
        messagesFall = messages;
    }
}

function indexTrim(str, ch) {
    var start = 0,
        end = str.length;

    while(start < end && str[start] === ch)
        ++start;

    while(end > start && str[end - 1] === ch)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

function myLocalize()
{
    var arg = Array.prototype.slice.call(arguments);
    /** @type {String} */
    let key = indexTrim(arg[0],'%');
    if(key in messages) {
        key = messages[key];
    } else if(key in messagesFall) {
        key = messagesFall[key];
    } else {
        key = "Error: '" + key + "' not found";
    }
    arg[0]=key;
    arg.splice(0,0,null);
    return localize.apply(null, arg)
}

exports.reInit = reInit;
exports.localize = myLocalize;