/* eslint-env browser */
const vscode = acquireVsCodeApi();

var harbour = {};
function readConfig() {
    harbour = {};
    $(".config").each((idx,ele) => {
        ele.onchange = onChange;
        var depth = ele.id.split(".");
        if(depth[0]!="harbour") return;
        var obj = {}, currDest = obj;
        for(let i=1;i<depth.length-1;++i) {
            currDest[depth[i]]={};
            currDest = currDest[depth[i]];
        }
        switch (ele.tagName) {
            case "INPUT":
                switch (ele.type) {
                    case "checkbox":
                        currDest[depth[depth.length-1]] = ele.checked;
                        break;
                    default:
                        break;
                }
                break;
            case "SELECT":
                currDest[depth[depth.length-1]] = ele.value;
            default:
                break;
        }
        $.extend(true,harbour,obj);
        //console.log(ele);
    })
    var changeCmd = {"command":"currConfig","value":harbour}
    vscode.postMessage(changeCmd);

}
String.prototype.contains = function(p) {
    return this.indexOf(p)>=0;
}
const tabSize = 4;
function naiveFormat(code) {
    var lines = code.replace("\r","").split("\n");
    var currTab = 0;
    var inFunction = false, inIf = 0;
    for(let i=0;i<lines.length;++i) {
        /** @type {String} */
        var line = lines[i].toLocaleLowerCase();
        if(inFunction && line.startsWith("retu")) { // no return inside function allowed on samples
            inFunction = false;
            if(harbour.formatter.indent.funcBody)
                currTab -= tabSize;
        }
        if(inIf && (line.startsWith("end") || line.startsWith("next"))) {
            currTab-=tabSize*inIf;
            inIf = 0;
        }
        var t = currTab;
        if(inFunction && !harbour.formatter.indent.variables && harbour.formatter.indent.funcBody && line.startsWith("loca"))
            t-=tabSize;
        if(inIf && harbour.formatter.indent.case && line.startsWith("case"))
            t-=tabSize;
        var spaces = " ".repeat(t);
        lines[i] = spaces + lines[i];
        if(line.startsWith("func") || line.startsWith("proc")) {
            inFunction = true;
            if(harbour.formatter.indent.funcBody)
                currTab+=tabSize;
        }
        if(line.startsWith("if ")&& harbour.formatter.indent.logical) {
            inIf = 1;
            currTab+=tabSize;
        }
        if(line.startsWith("for ")&& harbour.formatter.indent.cycle) {
            inIf = 1;
            currTab+=tabSize;
        }
        if(line.startsWith("switch") && (harbour.formatter.indent.switch || harbour.formatter.indent.case)) {
            inIf = 1;
            if(harbour.formatter.indent.switch && harbour.formatter.indent.case)
                inIf += 1;
            currTab+=tabSize*inIf;
        }
        if(harbour.formatter.replace.not!="ignore" && line.startsWith("if "))
            switch (harbour.formatter.replace.not) {
                case "use .not.":
                    lines[i] = lines[i].replace(/!/g,".not.")
                    break;
                case "use !":
                    lines[i] = lines[i].replace(/\.not\./g,"!")
                    break;
                default:
                    break;
            }
        if(harbour.formatter.replace.asterisk!="ignore" && (line.startsWith("*")||line.startsWith("//")||line.startsWith("&&"))) {
            line = line.substring(line.startsWith("*")?1:2);
            switch (harbour.formatter.replace.asterisk) {
                case "use //":
                    lines[i] = spaces+"//"+line
                    break;
                case "use *":
                    lines[i] = spaces+"*"+line
                    break;
                case "use &&":
                    lines[i] = spaces+"&&"+line
                    break;
                default:
                    break;
            }
        } else
        if(harbour.formatter.replace.amp!="ignore" && (line.contains("//")||line.contains("&&"))) {
            switch (harbour.formatter.replace.amp) {
                case "use //":
                    lines[i] = lines[i].replace("&&","//");
                    break;
                case "use &&":
                    lines[i] = lines[i].replace("//","&&");
                    break;
                default:
                    break;
            }
        }
    }
    return lines.join("\n");
}


function naiveSyntaxHightlight(code) {
    var html = code.replace(/&/g, "&amp;");
    html = html.replace(/</g, "&lt;");
    html = html.replace(/>/g, "&gt;")
    html = html.replace(/"/g, "&quot;")
    html = html.replace(/'/g, "&#039;")
    html = html.replace(/^(\s*\*.*)$/mg,"<span class='comment'>$1</span>")
    html = html.replace(/((?:&amp;&amp;|\/\/).*)$/mg,"<span class='comment'>$1</span>")
    html = html.replace(/^(\s*#\S+)/ig,"<span class='keyword'>$1</span>");
    html = html.replace(/(func(?:t(?:i(?:o(?:n)?)?)?)?)/ig,"<span class='keyword'>$1</span>");
    html = html.replace(/(proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)/ig,"<span class='keyword'>$1</span>");
    html = html.replace(/(loca(?:l)?)/ig,"<span class='keyword'>$1</span>");
    html = html.replace(/(retu(?:r(?:n)?)?)/ig,"<span class='keyword'>$1</span>");
    html = html.replace(/(if|end|\!|\.not\.|switch|case|exit|for|to|next)/ig,"<span class='keyword'>$1</span>");
    return html;
}

function setPreview(code) {
    $("#preview").html(naiveSyntaxHightlight(naiveFormat(code)));
}

// remember do NOT put spaces at beginning of lines!!
const code =`#include <hbclass.ch>

* Fake function for formatting
proc test(p1,p2)
local a,b,n && illogic code
a:=p1+p2
b:=p1-p2
if ! b>0
a*=2
endif
if .not. a>0
b/=2
endif
switch Mod(a,2)
case 0
a/=2
exit
case 1
a*=2
exit
end switch
for n:=1 to b
b+=n
next
return a+b // how much is it?
// end
`;

function onChange(e) {
    console.log("change")
    readConfig();
    setPreview(code);
}

$(()=>{
    readConfig();
    //console.log(harbour);
    setPreview(code);
});
