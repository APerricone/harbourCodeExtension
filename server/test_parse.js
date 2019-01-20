var provider = require('./src/provider.js');

var p = new provider.Provider();
p.parseFile("../test/db1.prg").then(()=>
{
    for (var fn in p.funcList) {
        if (p.funcList.hasOwnProperty(fn)) {
            var info = p.funcList[fn];
            var msg = `${info.kind}: ${info.name} (${info.foundLike})`;
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
    for(var db in p.databases) if (p.databases.hasOwnProperty(db))
    {
        console.log(`database ${p.databases[db].name}`); 
        for(var f in p.databases[db].fields) if (p.databases[db].fields.hasOwnProperty(f)) {
        console.log(`   field ${p.databases[db].fields[f]}`); 
    } }
    process.exit();
});
