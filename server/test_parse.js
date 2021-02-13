var provider = require('./src/provider.js');

var p = new provider.Provider();
p.doGroups = true;
var src = "..\\test\\minimal.prg";
//src="C:\\Perry\\ProgramFileCreatingHighCPUUseV3.prg"
//src = "c:\\fwh\\include\\fivewin.ch"
//src="C:\\Harbour32\\tests\\hbpp\\hbpptest.prg"
console.log(new Date())
var s = Number(Date.now())
p.parseFile(src).then(()=> {
    console.log(new Date())
    console.log(Number(Date.now())-s)
    console.log( Object.keys(p.references).length )
    for (var fn in p.funcList) {
        if (p.funcList.hasOwnProperty(fn)) {
            var info = p.funcList[fn];
            var msg = `${info.kind}: ${info.name} (${info.foundLike})`;
            if(info.parent) msg+= ` of ${info.parent.name}`
            if(info.comment) msg+= `(${info.comment})`
            msg+= ` in ${info.document}(${info.startLine}:${info.startCol})-(${info.endLine}:${info.endCol})`
            console.log(msg)
        }
    }
    for(var db in p.databases) if (p.databases.hasOwnProperty(db)) {
        console.log(`database ${p.databases[db].name}`);
        for(var f in p.databases[db].fields) if (p.databases[db].fields.hasOwnProperty(f)) {
            console.log(`   field ${p.databases[db].fields[f]}`);
    } }
    for(var i=0;i<p.groups.length;i++) {
        console.log(`group ${p.groups[i].type}`);
        for(j=0;j<p.groups[i].positions.length;j++) {
            console.log(`  line ${p.groups[i].positions[j].line} from ${p.groups[i].positions[j].startCol} to ${p.groups[i].positions[j].endCol}`);
        }
    }
    for(var i=0;i<p.preprocGroups.length;i++) {
        console.log(`group ${p.preprocGroups[i].type}`);
        for(j=0;j<p.preprocGroups[i].positions.length;j++) {
            console.log(`  line ${p.preprocGroups[i].positions[j].line} from ${p.preprocGroups[i].positions[j].startCol} to ${p.preprocGroups[i].positions[j].endCol}`);
        }
    }
    for(var i=0;i<p.multilineComments.length;i++) {
        console.log(`multiline comment from ${p.multilineComments[i][0]} to ${p.multilineComments[i][1]}`);
    }
    for (let i = 0; i < p.cCodeFolder.length; i++) {
        const folder = p.cCodeFolder[i];
        console.log(`cFolder from ${folder[0]}-${folder[1]} to ${folder[2]}-${folder[3]}`);
    }
    for (let i = 0; i < p.commands.length; i++) {
        const command = p.commands[i];
        console.log(`Comand ${command.name} defined from line ${command.startLine} to line ${command.endLine} found if ${command.regEx}`);
        for (let j = 0; j < command.length; j++) {
            const thisPart = command[j];
            console.log(`   snippet ${thisPart.fixed?"fixed   ":"optional"} ${thisPart.repeatable?"repeatable":"          "}: ${thisPart.text} => ${thisPart.snippet} found if ${thisPart.regEx}`);
        }
    }
    process.exit();
});
