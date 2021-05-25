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
                currDest[depth[depth.length-1]] = ele.selectedIndex;
            default:
                break;
        }
        $.extend(true,harbour,obj);
        //console.log(ele);
    })
}
const tabSize = 4;
function naiveFormat(code) {
    var lines = code.replace("\r","").split("\n");
    var currTab = 0;
    var inFunction = false;
    for(let i=0;i<lines.length;++i) {
        /** @type {String} */
        var line = lines[i].toLocaleLowerCase().trimStart();
        var t = currTab;
        if(line.startsWith("loca") && !harbour.formatter.indent.variables && harbour.formatter.indent.funcBody)
            t-=tabSize;
        if(line.startsWith("retu")) { // no return inside function allowed on samples
            inFunction = false;
            if(harbour.formatter.indent.funcBody) {
                currTab -= tabSize;
                t -= tabSize;
            }
        }
        lines[i] = " ".repeat(t) + lines[i].trimStart();
        if(line.startsWith("func") || line.startsWith("proc")) {
            inFunction = true;
            if(harbour.formatter.indent.funcBody)
                currTab+=tabSize;
        }
        if(line.startsWith("if ") && harbour.formatter.replace.not>0)
            switch (harbour.formatter.replace.not) {
                case 1:
                    lines[i] = lines[i].replace(/!/,".not.")
                    break;
                case 2:
                    lines[i] = lines[i].replace(/\.not\./,"!")
                    break;
                default:
                    break;
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
    html = html.replace(/(if|end)/ig,"<span class='keyword'>$1</span>");
    return html;
}

function setPreview(code) {
    $("#preview").html(naiveSyntaxHightlight(naiveFormat(code)));
}

const code =`#include <hbclass.ch>

* Fake function for formatting
proc test(p1,p2)
local a,b && illogic code
a:=p1+p2
b:=p1-p2
if ! b>0
a*=2
endif
if .not. a>0
b/=2
endif
return a+b
`;

function onChange() {
    console.log("change")
    readConfig();
    setPreview(code);
}

$(()=>{
    readConfig();
    //console.log(harbour);
    setPreview(code);
});
