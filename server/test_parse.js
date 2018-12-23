var provider = require('./src/provider.js');

var p = new provider.Provider();
p.parseFile("../test/errors.prg").then(()=>
{
    for (var fn in p.funcList) {
        if (p.funcList.hasOwnProperty(fn)) {
            var info = p.funcList[fn];
            var msg = `${info.kind}: ${info.name}`;
            if(info.parent)
            {
                msg+= ` of ${info.parent.name}`
            }
            if(info.comment)
            {
                msg+= `(${info.comment})`
            }
            msg+= ` in ${info.document}(${info.startLine}:${info.startCol})-(${info.endLine}:${info.endCol})`
            console.log(msg)
        }
    }
    process.exit();
});
