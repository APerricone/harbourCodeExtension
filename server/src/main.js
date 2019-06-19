var provider = require('./provider.js');
var server = require('vscode-languageserver')
var fs = require("fs");
var path = require("path");
var Uri = require("vscode-uri").default;

var connection = server.createConnection(
        new server.IPCMessageReader(process), 
        new server.IPCMessageWriter(process));

/** @type {Array<string>} */
var workspaceRoots;
/** @type {Array<string>} */
var includeDirs;
/** @type {number} */
var workspaceDepth;
/** @type {boolean} */
var wordBasedSuggestions;
/** @type {Object.<string, Provider>} */
var files;
/** @type {Object.<string, Provider>} */
var includes;
/** @type {Array} */
var docs;
/** @type {Array} */
var missing
/**
 * @typedef dbInfo
 * @property {string} dbInfo.name the name to show
 * @property {fieldInfo[]} dbInfo.fields the fields found for the database
 * 
 * @typedef fieldInfo
 * @property {string} fieldInfo.name the name to show
 * @property {string[]} fieldInfo.files the list of files where the field is found
 */
/** @type {Object.<string, dbInfo>} every key is the lowercase name of db */
var databases;
/** @type {boolean} */
var canLocationLink;

var keywords = [
    "function","procedure","return",
    "if","else","elseif","end if",
    "end while","end case","end do","end switch","end class","end sequence",
    "do while","case","switch","endcase","otherwise","default",
    "for","for each","to","in","next",
    "exit","loop","try","catch","finally",
    "begin sequence","begin sequence with",
    "recover","recover using"]

/*
    every database contiens a name (the text before the ->)
    and a list of field, objects with name (the text after the ->)
    and a files, array of string with the file where found the db.name->field.name
*/
connection.onInitialize(params => 
{
    canLocationLink = false;
    if( params.capabilities.textDocument &&
        params.capabilities.textDocument.declaration &&
        params.capabilities.textDocument.declaration.linkSupport )
            canLocationLink = true;
    if(params.capabilities.workspace && params.capabilities.workspace.workspaceFolders && params.workspaceFolders) {
        workspaceRoots = [];
        for(var i=0;i<params.workspaceFolders.length;i++)
        {
            workspaceRoots.push(params.workspaceFolders[i].uri)
        }
    } else {
        workspaceRoots = [params.rootUri];
        if(!workspaceRoots[0] && params.rootPath)
        {
            if(path.sep=="\\") //window
                workspaceRoots = ["file://"+encodeURI(params.rootPath.replace(/\\/g,"/"))];
            else
                workspaceRoots = ["file://"+encodeURI(params.rootPath)];
        }
    }
    fs.readFile(path.join(__dirname, 'hbdocs.json'), "utf8",(err,data) =>
    {
        if(!err)
            docs = JSON.parse(data);
    });
    fs.readFile(path.join(__dirname, 'hbdocs.missing'), "utf8",(err,data) =>
    {
        if(!err)
            missing = data.split(/\r\n{1,2}/g)
    });
	return {
		capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
           // declarationProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(']
            },
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['>', '<', '"']
            },
			// Tell the client that the server works in FULL text document sync mode
            textDocumentSync: 1,
            workspace: {
                supported: true
            },
            hoverProvider: true
        }
	}
});
/*
connection.workspace.onDidChangeWorkspaceFolders(params=>{
    var i=0;
})
*/
connection.onDidChangeConfiguration(params=>{
    var searchExclude = params.settings.search.exclude;
    // minimatch
    includeDirs = params.settings.harbour.extraIncludePaths;
    includeDirs.splice(0,0,".")
    workspaceDepth = params.settings.harbour.workspaceDepth;
    wordBasedSuggestions = params.settings.editor.wordBasedSuggestions
    ParseWorkspace();

})

function ParseDir(dir, onlyHeader, depth, subirPaths)
{
    if(!subirPaths) subirPaths = [];
    //fs.readdir(dir,{withFileTypes:true},function(err,ff)
    fs.readdir(dir,function(err,ff)
    {
        if(ff==undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            var completePath = path.join(dir,fileName);
            var info = fs.statSync(completePath);
            if(info.isFile())
            {
                var ext = path.extname(fileName).toLowerCase();
                if (onlyHeader &&  ext!=".ch" && ext!=".h")
                {
                    continue;
                }
                var cMode = (ext.startsWith(".c") && ext!=".ch") || ext == ".h"
                if(cMode)
                {
                    var harbourFile = path.basename(fileName)
                    var pos = harbourFile.lastIndexOf(".");
                    harbourFile = harbourFile.substr(0, pos < 0 ? harbourFile.length : pos) + ".prg";
                    if(subirPaths.findIndex((v) => v.indexOf(harbourFile)>=0)>=0)
                        continue;                    
                }
                if(	ext == ".prg" || ext == ".ch" || cMode )
                {
                    subirPaths.push(completePath);
                    var fileUri = Uri.file(completePath);
                    var pp = new provider.Provider(true);
                    pp.parseFile(completePath,fileUri.toString(), cMode).then(
                        prov => {
                            UpdateFile(prov)
                        }
                    )
                }
            } else if(info.isDirectory() && depth>0)
            {
                ParseDir(path.join(dir,fileName),onlyHeader,depth-1,subirPaths);
            }
        }
    });
}

function ParseWorkspace() 
{
    databases = {};
    files = {};
    includes = {};
    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") return;
        ParseDir(uri.fsPath,false,workspaceDepth);
    }
    //for(var i=0;i<includeDirs.length;i++)
    //{
    //    ParseDir(includeDirs[i], true,0);
    //}
}

var documents = new server.TextDocuments();
documents.listen(connection);
documents.onDidSave((e)=>
{
    var uri = Uri.parse(e.document.uri);
    if(uri.scheme != "file") return;
    var found = false;
    for(var i=0;i<workspaceRoots.length;i++)
        if(e.document.uri.startsWith(workspaceRoots[i]))
            found = true;
    if(!found) return; //not include file outside the current workspace
    var ext = path.extname(uri.fsPath).toLowerCase();
    var cMode = (ext.startsWith(".c") && ext!=".ch")
    if(	ext == ".prg" || ext == ".ch" || cMode )
    {
        var pp = parseDocument(e.document, cMode)
        UpdateFile(pp);
    }
})

/**
 * Update a file in the workspace
 * @param {provider.Provider} pp 
 */
function UpdateFile(pp)
{
    var doc = pp.currentDocument;
    var ext = path.extname(pp.currentDocument).toLowerCase();
    if( ext!=".prg" ) 
    {
        files[doc] = pp;
        return;
    }
    if(doc in files)
        for(var db in databases)
        {
            for(var f in databases[db].fields)
            {
                var idx = databases[db].fields[f].files.indexOf(doc);
                if(idx>=0)
                {
                    databases[db].fields[f].files.splice(idx,1);
                    if(databases[db].fields[f].files.length==0)
                    {
                        delete databases[db].fields[f];
                    }
                }
            }
            if(Object.keys(databases[db].fields).length==0)
            {
                delete databases[db];
            }
        }
    files[doc] = pp;
    for(var db in pp.databases)
    {
        var ppdb = pp.databases[db];
        if(!(db in databases)) databases[db]={name:ppdb.name, fields: {}};
        var gbdb = databases[db];
        for(var f in ppdb.fields)
        {
            if(!(f in gbdb.fields))
                gbdb.fields[f]={name: ppdb.fields[f], files: [doc]}; 
            else
            {        
                var idx = gbdb.fields[f].files.indexOf(doc);
                if(idx<0) gbdb.fields[f].files.push(doc);                    
            }
        }
    }
    AddIncludes(path.dirname(doc) ,pp.includes);
}

function AddIncludes(startPath, includesArray)
{
    if(includesArray.length==0)
        return;
    if(startPath.startsWith("file:///"))
        startPath=Uri.parse(startPath).fsPath;
    function FindInclude(dir,fileName)
    {
        //var ext= path.extname(ff[fi]).toLowerCase();
        //if( ext != '.ch') return
        if(!path.isAbsolute(dir))
            dir = path.join(startPath,dir);
        if(!fs.existsSync(dir)) return false;
        if(fileName.length<1)
            return false;
        var completePath = path.join(dir,fileName);
        if(!fs.existsSync(completePath)) return false;
        var fileUri = Uri.file(completePath);
        var pp = new provider.Provider(true);
        pp.parseFile(completePath,fileUri.toString(), false).then(
            prov => {
                includes[fileName] = prov;
                AddIncludes(dir, prov.includes);
                    }
                )
        return true;
    }
    for(var j=0;j<includesArray.length;j++)
    {
        var inc = includesArray[j];
        if(inc in includes)
            continue
        var found = false;
        for(var i=0;i<workspaceRoots.length;i++)
        {
            // other scheme of uri unsupported
            /** @type {vscode-uri.default} */
            var uri = Uri.parse(workspaceRoots[i]);
            if(uri.scheme != "file") continue;
            found = FindInclude(uri.fsPath,inc);
            if(found) break;
        }
        if(found) continue;
        for(var i=0;i<includeDirs.length;i++)
        {
            found = FindInclude(includeDirs[i],inc);
            if(found) break;
        }
    }
}

function ParseInclude(startPath, includeName, addGlobal)
{
    if(includeName.length==0)
        return undefined;
    if(includeName in includes)
        return includes[includeName];
    function FindInclude(dir)
    {
        if(!path.isAbsolute(dir))
            dir = path.join(startPath,dir);
        if(!fs.existsSync(dir)) return undefined;
        var test = path.join(dir,includeName);
        if(!fs.existsSync(test)) return undefined;
        var pp = new provider.Provider();
        pp.parseString(fs.readFileSync(test).toString() ,Uri.file(test).toString() );
        if(addGlobal)
            includes[includeName] = pp;
        return pp;
    }
    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") continue;
        var r = FindInclude(uri.fsPath);
        if(r) return r;
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        var r = FindInclude(includeDirs[i]);
        if(r) return r;
    }
}

function kindTOVS(kind,sk)
{
    if(sk==undefined) sk=true;
    switch(kind)
    {
        case "class":
            return sk? server.SymbolKind.Class : server.CompletionItemKind.Class;
        case "method":
            return sk? server.SymbolKind.Method : server.CompletionItemKind.Method;
        case "data":
            return sk? server.SymbolKind.Property : server.CompletionItemKind.Property;
        case "function":
        case "procedure":
        case "function*":
        case "procedure*":
        case "C-FUNC":
            return sk? server.SymbolKind.Function : server.CompletionItemKind.Function;
        case "local":
        case "static":
        case "public":
        case "private":
        case "param":
        case "memvar":
            return sk? server.SymbolKind.Variable : server.CompletionItemKind.Variable;
        case "field":
            return sk? server.SymbolKind.Field : server.CompletionItemKind.Field;
        case "define":
            return sk? server.SymbolKind.Constant : server.CompletionItemKind.Constant;
    }
    return 0;
}

connection.onDocumentSymbol((param)=>
{
    var p = parseDocument(documents.get(param.textDocument.uri));
    /** @type {server.DocumentSymbol[]} */
    var dest = [];
    for (var fn in p.funcList) {
        //if (p.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = p.funcList[fn];
            var selRange =server.Range.create(info.startLine,info.startCol, info.endLine,info.endCol);
            if(info.endLine!=info.startLine)
                selRange.end = server.Position.create(info.startLine,1000);
            var docSym = server.DocumentSymbol.create(info.name,info.name,
                    kindTOVS(info.kind),
                    server.Range.create(info.startLine,info.startCol,
                        info.endLine,info.endCol), selRange,undefined);
            var parent = dest;
            if(info.parent && info.startLine<info.parent.endLine)
            {
                var pp = info.parent;
                var names = [];
                while(pp)
                {
                    names.push(pp.name);
                    pp=pp.parent;
                }
                while(names.length>0)
                {
                    var n = names.pop();
                    var i = parent.findIndex((v)=> (v.name == n) );
                    if(i>=0)
                    {
                        parent=parent[i];
                        if(!parent.children )
                            parent.children=[];
                        parent = parent.children;
                    }
                }
            }
            parent.push(docSym);
        //}        
    };
    return dest;
});

function IsInside(word1, word2)
{
	var ret = "";
    var i1 = 0;
    var lenMatch =0, maxLenMatch = 0, minLenMatch = word1.length;
	for(var i2=0;i2<word2.length;i2++)
	{
		if(word1[i1]==word2[i2])
		{
            lenMatch++;
            if(lenMatch>maxLenMatch) maxLenMatch = lenMatch;
			ret+=word1[i1];
			i1++;
            if(i1==word1.length)
            {
                return ret;
            }
		} else
		{
            ret+="Z";
            if(lenMatch>0 && lenMatch<minLenMatch)
                minLenMatch = lenMatch;
            lenMatch=0;
		}
	}
	return undefined;
}

connection.onWorkspaceSymbol((param)=>
{
    var dest = [];
    var src = param.query.toLowerCase();
    var parent = undefined;
    var colon = src.indexOf(':');
    if(colon>0)
    {
        parent = src.substring(0,colon);
        src = src.substr(colon+1);
    }
    for (var file in files) { //if (files.hasOwnProperty(file)) {
        var pp = files[file];
        for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if( info.kind != "class" && info.kind != "method" && 
                info.kind != "data" && info.kind != "public" && 
                info.kind != "define" && 
                !info.kind.startsWith("procedure") && 
                !info.kind.startsWith("function"))
                continue;
            // workspace symbols takes statics too
            if(src.length>0 && !IsInside(src,info.nameCmp))
                continue;
            // public has parent, but they are visible everywhere
            if(parent && info.kind != "public" && (!info.parent || !IsInside(parent,info.parent.nameCmp)))
                continue;
            dest.push(server.SymbolInformation.create(
                info.name, kindTOVS(info.kind),
                server.Range.create(info.startLine,info.startCol,
                                    info.endLine,info.endCol),
                file, info.parent?info.parent.name:""));
            if(dest.length==100)
                return dest;
        }
    }
    return dest;
});

function GetWord(params,withPrec)
{
    var doc = documents.get(params.textDocument.uri);
    var pos = doc.offsetAt(params.position);
    var delta = 20;
    var word, prec;
    //var allText = doc.getText();
    var r = /\b[a-z_][a-z0-9_]*\b/gi
    while(true)
    {
        r.lastIndex = 0;
        //var text = allText.substr(Math.max(pos-delta,0),delta+delta)
        var text = doc.getText(server.Range.create(doc.positionAt(Math.max(pos-delta,0)),doc.positionAt(pos+delta)));
        var txtPos = pos<delta? pos : delta;
        while(word = r.exec(text))
        {
            if(word.index<=txtPos && word.index+word[0].length>=txtPos)
                break;
        }
        if(!word) return [];
        if(word.index!=0 && (word.index+word[0].length)!=(delta+delta))
        {
            prec = text[word.index-1];
            break;
        }
        delta+=10;
    }
    word = word[0];
    return withPrec? [word,prec] : word;
}

connection.onDefinition((params)=>
{
    var doc = documents.get(params.textDocument.uri);
    var line = doc.getText(server.Range.create(params.position.line,0,params.position.line,100));
    var include = /^\s*#include\s+[<"]([^>"]*)/i.exec(line);
    if(include!==null)
    {
        var startPath = undefined;
        if(params.textDocument.uri && params.textDocument.uri.startsWith("file"))
        {
            startPath = path.dirname(Uri.parse(params.textDocument.uri).fsPath);
        }
        var pos = include[0].indexOf(include[1]);
        return definitionFiles(include[1],startPath, server.Range.create(params.position.line,pos,params.position.line,pos+include[1].length));
    }
    var word=GetWord(params,true);
    if(word.length==0) return undefined;        
    var dest = [];
    var thisDone = false;
    var prec = word[1];
    word = word[0].toLowerCase();
    function DoProvider(pp,file)
    {
        for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if(info.foundLike!="definition")
                continue;
            if(info.nameCmp != word)
                continue;
            if(info.kind.endsWith("*") && file!=doc.uri)
                continue;
            if(info.kind=='static' && file!=doc.uri)
                continue;
            if((info.kind=='data' || info.kind=='method') && prec!=':')
                continue;
            //if(info.kind=='field' && prec!='>')
            //    continue;
            if(info.kind=='local' || info.kind=='param')
            {
                if(file!=doc.uri)
                    continue;
                var parent = info.parent;
                if(parent)
                {
                    if(parent.startLine>params.position.line)
                        continue;
                    if(parent.endLine<params.position.line)
                        continue;
                }            
            }
            dest.push(server.Location.create(file,
                server.Range.create(info.startLine,info.startCol,
                                info.endLine,info.endCol)));
        }        
    }
    for (var file in files) { //if (files.hasOwnProperty(file)) {
        if(file==doc.uri)
        {
            var pp = parseDocument(doc);
            UpdateFile(pp)
            thisDone = true;
        }
        DoProvider(files[file],file);
    }
    var pThis
    if(!thisDone)
    {
        pThis = parseDocument(doc);
        DoProvider(pThis,doc.uri);
    } else
        pThis = files[doc.uri];

    var includes = pThis.includes;
    var i=0;
    var startDir = path.dirname(Uri.parse( doc.uri ).fsPath);
    while(i<includes.length)
    {
        pp = ParseInclude(startDir,includes[i],thisDone);
        if(pp)
        {
            DoProvider(pp,pp.currentDocument)
            for(var j=0;j<pp.includes;j++)
            {
                if(includes.indexOf(pp.includes[j])<0)
                    includes.push(pp.includes[j]); 
            }
        }
        i++;
    }

    return dest;
})

connection.onSignatureHelp((params)=>
{
    var doc = documents.get(params.textDocument.uri);
    var pos = doc.offsetAt(params.position)-1;
    /** @type {string} */
    var text = doc.getText();
    // backwards find (
    pos=findBracket(text,pos,-1,"(")
    if(pos===undefined) return pos;
    // Get parameter position
    var endPos=doc.offsetAt(params.position)
    var nC = CountParameter(text.substr(pos+1,endPos-pos-1), doc.offsetAt(params.position)-pos-1)
    // Get the word
    pos--;
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    while(rge.test(text[pos]))
    {
        word = text[pos]+word;
        pos--;
    }
    word=word.toLowerCase();
    // special case for new, search the class name
    if(word=="new")
    {
        var prec = text.substring(pos-2,pos+1);
        if(prec = "():")
        {
            pos-=3;
            className="";
            while(rge.test(text[pos]))
            {
                className = text[pos]+className;
                pos--;
            }
            className = className.toLowerCase();
        }
    }
    var signatures = [].concat(getStdHelp(word, nC));
    signatures = signatures.concat(getWorkspaceSignatures(word, doc, className, nC));
    return {signatures:signatures, activeParameter:nC}
})

/**
 * 
 * @param {String} text
 * @param {Number} pos 
 * @param {Number} dir 
 * @param {String} bracket 
 */
function findBracket(text,pos,dir,bracket)
{
    var nP = 0, str
    while(nP!=0 || text[pos]!=bracket || str!=undefined )
    {
        if(pos<0) return undefined;
        if(pos>=text.length) return undefined;
        if(str)
        {
            if(text[pos]==str)
                str=undefined;
        } else
        {
            switch (text[pos]) {
                case '(': nP--; break;
                case ')': nP++; break;
                case '[': if(dir>0) str=']'; break
                case ']': if(dir<0) str='['; break
                case '{': if(dir>0) str='}'; break
                case '}': if(dir<0) str='{'; break
                case '"': str='"'; break
                case "'": str="'"; break
                case '\n': 
                    var nSpace = 1;
                    while(text[pos-nSpace]!='\n') nSpace++;                    
                    var thisLine = text.substr(pos-nSpace+1,nSpace)
                    thisLine=thisLine.replace( /\/\/[^\n]*\n/,"\n")
                    thisLine=thisLine.replace( /&&[^\n]*\n/,"\n")
                    thisLine=thisLine.replace( /\s+\n/,"\n")
                    if (thisLine[thisLine.length-2]==';')
                        break;
                    return undefined;
                    break;
            }
        }
        pos+=dir;
    }        
    return pos
}

/**
 * 
 * @param {String} txt The text where count the parameter
 * @param {Number} position Position of cursor
 */
function CountParameter(txt, position)
{
    var  i=0;
	while(true)
	{
		i++;
		var filter=undefined;
		switch(i)
		{
			case 1: filter = /;\s*\r?\n/g; break;  // new line with ;
			case 2: filter = /'[^']*'/g; break; // ' strings
			case 3: filter = /"[^"]*"/g; break; // " strings
			case 4: filter = /\[[^\[\]]*\]/g; break; // [] strings or array index
			case 5: filter = /{[^{}]*}/g; break; // {} array
			case 6: filter = /\([^\(\)]*\)/g; break; // couple of parenthesis
		}
		if (filter == undefined)
			break;
		do
		{
            var someChange = false
            txt=txt.replace(filter,function(matchString)
            {
                someChange = true;
                return Array(matchString.length+1).join("X");
            })
		} while(someChange)
    }
    return (txt.substr(0,position).match(/,/g) || []).length
}

function getWorkspaceSignatures(word, doc, className, nC)
{
    var signatures = [];
    var thisDone = false;
    for (var file in files) //if (files.hasOwnProperty(file)) 
    {
        if(file==doc.uri)
        {
            var pp=parseDocument(doc);
            UpdateFile(pp)
            thisDone = true;
        }
        var pp = files[file];
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if(info.nameCmp != word)
                continue;
            if(info.kind.endsWith("*") && file!=doc.uri)
                continue;
            var s = {}
            if (info.kind.startsWith("method"))
                if(info.parent)
                {
                    s["label"] = info.parent.name+":"+info.name;
                    if(className && className!=info.parent.nameCmp)
                        continue;
                }
                else
                {
                    s["label"] = "??:"+info.name;
                    if(className)
                        continue;
                }
            else
                s["label"] = info.name;
            s["label"] += "("
            var subParams = [];
            for (var iParam=iSign+1;iParam<pp.funcList.length;iParam++)
            {
                /** @type {provider.Info} */
                var subinfo = pp.funcList[iParam];
                if(subinfo.parent==info && subinfo.kind=="param")
                {
                    subParams.push({"label":subinfo.name})
                    if(!s.label.endsWith("("))
                        s.label += ", "
                    s.label+=subinfo.name
                } else
                    break;
            }
            s["label"] += ")"
            s["parameters"]=subParams;
            if(info.comment && info.comment.trim().length>0)
                s["documentation"]=info.comment 
            if(subParams.length>=nC)
                signatures.push(s);
        }
    }
    if(!thisDone)
    {
        var pp = parseDocument(doc);
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if(info.nameCmp != word)
                continue;
            var s = {}                
            if (info.kind.startsWith("method"))
                if(info.parent)
                {
                    s["label"] = info.parent.name+":"+info.name;
                    if(className && className!=info.parent.nameCmp)
                        continue;
                }
                else
                {
                    s["label"] = "??:"+info.name;
                    if(className)
                        continue;
                }
            else
                s["label"] = info.name;
            s["label"] += "("
            var subParams = [];
            for (var iParam=iSign+1;iParam<pp.funcList.length;iParam++)
            {
                /** @type {provider.Info} */
                var subinfo = pp.funcList[iParam];
                if(subinfo.parent==info && subinfo.kind=="param")
                {
                    subParams.push({"label":subinfo.name})
                    if(!s.label.endsWith("("))
                        s.label += ", "
                    s.label+=subinfo.name
                } else
                    break;
            }
            s["label"] += ")"
            s["parameters"]=subParams;
            if(info.comment && info.comment.trim().length>0)
                s["documentation"]=info.comment 
            if(subParams.length>nC)
                signatures.push(s);
        }

    }
    return signatures;
}

function getStdHelp(word, nC)
{
    var signatures = [];
    for (var i = 0; i < docs.length; i++)
    {
        if (docs[i].name.toLowerCase() == word)
        {
            var s = {};
            s["label"] = docs[i].label;
            s["documentation"] = docs[i].documentation;
            var subParams = [];
            for (var iParam = 0; iParam < docs[i].arguments.length; iParam++)
            {
                subParams.push({
                    "label": docs[i].arguments[iParam].label,
                    "documentation": docs[i].arguments[iParam].documentation
                });
            }
            s["parameters"] = subParams;
            signatures.push(s);
        }
    }
    return signatures;
}

/**
 * 
 * @param {server.TextDocument} doc 
 * @param {boolean} cMode
 */
function parseDocument(doc,cMode)
{
    var pp = new provider.Provider(false)
    pp.Clear();
    pp.currentDocument=doc.uri;
	if(cMode != undefined)
        pp.cMode = cMode;
	for (var i = 0; i < doc.lineCount; i++) {
		pp.parse(doc.getText(server.Range.create(i,0,i,1000)));
	}
	pp.endParse();
    return pp;
}

connection.onCompletion((param, cancelled)=> 
{
    var doc = documents.get(param.textDocument.uri);
    var line = doc.getText(server.Range.create(param.position.line,0,param.position.line,1000));
    var include = line.match(/^\s*#include\s+[<"]([^>"]*)/i);
    var precLetter = doc.getText(server.Range.create(server.Position.create(param.position.line,param.position.character-1),param.position));    
    if(include!==null)
    {
        if(precLetter == '>')
        {
            return server.CompletionList.create([],false); // wrong call
        }
        var startPath = undefined;
        if(param.textDocument.uri && param.textDocument.uri.startsWith("file"))
        {
            startPath = path.dirname(Uri.parse(param.textDocument.uri).fsPath)
        }
        return completitionFiles(include[1], startPath);
    }
    var allText = doc.getText();
    var completitions = [];
    var pos = doc.offsetAt(param.position)-1
    // Get the word
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    var pp = parseDocument(doc);
    if(doc.uri in files)
    {
        UpdateFile(pp)
        pp=undefined;
    }
    while(pos>=0 && rge.test(allText[pos]))
    {
        word = allText[pos]+word;
        pos--;
    }
    word = word.toLowerCase();
    var precLetter = allText[pos];
    if(precLetter == '>')
    {
        if(allText[pos-1]=='-')
        {
            precLetter='->';
            completitions = CompletitionDBFields(word, allText,pos, pp)
            if(completitions.length>0)
                return server.CompletionList.create(completitions,true); // put true because added all known field of this db
        } else
        {
            return server.CompletionList.create([],false); // wrong call
        }
    }
    var done = {}
    function CheckAdd(label,kind,sort)
    {
        var ll = label.toLowerCase()
        if(ll in done)
            return;
        done[ll]=true;
        var sortLabel = IsInside(word,ll);
        if(sortLabel===undefined)
            return undefined;
        //var c =completitions.find( (v) => v.label.toLowerCase() == ll );
        //if(!c)
        {
            c = server.CompletionItem.create(label);
            c.kind = kind
            c.sortText = sort + sortLabel
            completitions.push(c);
        }
        return c;
    }
    if(precLetter != '->' && precLetter!=':') precLetter = undefined;
    if(word.length==0 && precLetter==undefined) return server.CompletionList.create(completitions,false);
    if(!precLetter)
    {
        for(var dbName in databases)
        {
            CheckAdd(databases[dbName].name,server.CompletionItemKind.Struct,"AAAA")
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }
        if(pp)
        {
            for(var dbName in pp.databases)
            {
                CheckAdd(pp.databases[dbName].name,server.CompletionItemKind.Struct,"AAAA")
                if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
            }
        }
    }
    function GetCompletitions(pp,file)
    {
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if(word.length>0 && !IsInside(word,info.nameCmp))
                continue;
            if(info.endCol == param.position.character && info.endLine == param.position.line && file==doc.uri)
                continue;
            if(precLetter == '->' && info.kind != "field")
                continue;
            if(precLetter != '->' && info.kind == "field")
                continue;
            if(precLetter == ':' && info.kind != "method" && info.kind != "data")
                continue;
            if(precLetter != ':' && (info.kind == "method" || info.kind == "data"))
                continue;
            if(info.kind == "function*" || info.kind=="procedure*" || info.kind=="static")
            {
                if(file!=doc.uri)
                    continue;
            }
            //if(info.kind == "local" || info.kind == "param")
            if(info.parent && ( info.parent.kind.startsWith("function")  || info.parent.kind.startsWith("procedure") || info.parent.kind=='method'))
            {
                if(file!=doc.uri) continue;
                if(param.position.line<info.parent.startLine || 
                    param.position.line>info.parent.endLine)
                        continue;
            }
            var added = CheckAdd(info.name,kindTOVS(info.kind,false),"AAA");
            if(added && (info.kind == "method" || info.kind == "data") && info.parent)
                added.documentation = info.parent.name;
            if(cancelled.isCancellationRequested) return
        }
    }
    for (var file in files) // if (files.hasOwnProperty(file)) it is unnecessary
    {
        GetCompletitions(files[file],file);
        if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
    }
    if(pp)
    {
        GetCompletitions(pp,doc.uri);
    } else if(doc.uri in files)
    {
        pp = files[doc.uri]
    }
    if(pp)
    {
        var thisDone = doc.uri in files;
        var includes = pp.includes;
        var i=0;
        var startDir = path.dirname(Uri.parse( doc.uri ).fsPath);
        while(i<includes.length)
        {
            pInc = ParseInclude(startDir,includes[i],thisDone);
            if(pInc)
            {
                GetCompletitions(pInc,pInc.currentDocument)
                for(var j=0;j<pInc.includes;j++)
                {
                    if(includes.indexOf(pInc.includes[j])<0)
                        includes.push(pInc.includes[j]); 
                }
            }
            i++;
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }            
    }
    if(precLetter!=':' && precLetter!='->')
    {
        for (var i = 0; i < docs.length; i++)
        {
            var c = CheckAdd(docs[i].name,server.CompletionItemKind.Function,"AA")
            if(c) c.documentation = docs[i].documentation;
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }
        for (var i = 1; i < keywords.length; i++)
        {
            CheckAdd(keywords[i],server.CompletionItemKind.Keyword,"AAA")
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }
        for (var i = 1; i < missing.length; i++)
        {
            CheckAdd(missing[i],server.CompletionItemKind.Function,"A")
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }
        if (wordBasedSuggestions) 
        {
            var wordRE = /\b[a-z_][a-z0-9_]*\b/gi
            var foundWord;
            var pos = doc.offsetAt(param.position);
            while(foundWord = wordRE.exec(allText))
            {
                // remove current word
                if(foundWord.index<pos &&  foundWord.index+foundWord[0].length>=pos)
                    continue;
                CheckAdd(foundWord[0],server.CompletionItemKind.Text,"")
                if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
            }
        }
    }
    return server.CompletionList.create(completitions,false);
})

function completitionFiles(word, startPath)
{
    var completitons = [];
    word = word.replace("\r","").replace("\n","").toLowerCase()
    var startDone = false;
    if(startPath) startPath = startPath.toLowerCase();
    function CheckDir(dir)
    {
        if(!path.isAbsolute(dir))
            dir = path.join(startPath,dir);
        if(!fs.existsSync(dir)) return;
        
        if(startPath && dir.toLowerCase()==startPath) startDone=true;
        var ff = fs.readdirSync(dir)
        for(var fi=0;fi<ff.length;fi++)
        {
            var fileName = ff[fi].toLowerCase();
            var ext = path.extname(fileName);
            if(ext!=".h" && ext!=".ch")
                continue;
            var sortText = undefined;
            if(word.length != 0)
            {
                sortText = IsInside(word, fileName);
                if(!sortText)
                    continue;
            }
            var c = server.CompletionItem.create(ff[fi]);
            c.kind = server.CompletionItemKind.File;
            c.sortText = sortText? sortText : fileName;
            completitons.push(c);
        }
    }

    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") continue;
        CheckDir(uri.fsPath);
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        CheckDir(includeDirs[i]);
    }
    if(startPath && !startDone)
    {
        CheckDir(startPath);
    }
    return server.CompletionList.create(completitons,false);
}

function definitionFiles(fileName, startPath, origin)
{
    var dest = [];
    fileName = fileName.toLowerCase();
    var startDone = false;
    if(startPath) startPath = startPath.toLowerCase();
    function DefDir(dir)
    {
        if(!path.isAbsolute(dir))
            dir = path.join(startPath,dir);
        if(!fs.existsSync(dir)) return;
        if(startPath && dir.toLowerCase()==startPath) startDone=true;
        var ff = fs.readdirSync(dir)
        for(var fi=0;fi<ff.length;fi++)
        {
            if(ff[fi].toLowerCase() == fileName)
            {
                var fileUri = Uri.file(path.join(dir,ff[fi])).toString();
                if(canLocationLink)
                    dest.push(server.LocationLink.create(fileUri, server.Range.create(0,0,0,0), server.Range.create(0,0,0,0),origin));
                else
                    dest.push(server.Location.create(fileUri, server.Range.create(0,0,0,0)));
            }
        }
    }
    for(var i=0;i<workspaceRoots.length;i++)
    {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if(uri.scheme != "file") continue;
        DefDir(uri.fsPath);
    }
    for(var i=0;i<includeDirs.length;i++)
    {
        DefDir(includeDirs[i]);
    }
    if(startPath && !startDone)
    {
        DefDir(startPath);
    }
    return dest;
}


function CompletitionDBFields(word, allText,pos, pp)
{
    //precLetter = '->';
    var pdb = pos-2;
    var dbName = "";
    var nBracket = 0;
    while((allText[pdb]!=' ' && allText[pdb]!='\t') || nBracket>0)
    {
        var c = allText[pdb];
        pdb--;
        if(c==')') nBracket++;
        if(c=='(') nBracket--;
        dbName = c+dbName;
    }
    var completitions = [];
    function AddDB(db)
    {
        for(var f in db.fields)
        {
            var sortText = db.fields[f].name;
            if(word.length>0)
            {
                sortText = IsInside(word,f);
            }
            if(!sortText) continue;
            
            if(!completitions.find( (v) => v.label.toLowerCase() == db.fields[f].name.toLowerCase() ))
            {
                var c = server.CompletionItem.create(db.fields[f].name);
                c.kind = server.CompletionItemKind.Field;
                c.documentation = db.name;
                c.sortText = "AAAA" + sortText;
                completitions.push(c);
            }
        }
    }
    function CheckDB(databases)
    {
        if(!(dbName in databases))
        {
            // check if pick too much text
            for(db in databases)
            {
                if(dbName.endsWith(db))
                {
                    dbName = db;
                    break
                }
            }
        }
        if(dbName in databases) {
            AddDB(databases[dbName]);
        }    
    }
    dbName = dbName.toLowerCase().replace(" ","").replace("\t","");
    if(dbName.toLowerCase() == "field")
    {
        for(db in databases) AddDB(databases[db]);
        if(pp) for(db in pp.databases) AddDB(pp.databases[db]);
    } else
    {
        CheckDB(databases);
        if(pp && dbName in pp.databases)
        {
            CheckDB(pp.databases);
        }
    }
    return completitions;
}

connection.onHover((params,cancelled)=> {
    var w = GetWord(params);
    var doc = documents.get(params.textDocument.uri);
    var pp;
    if(doc.uri in files)
    {
        pp = files[doc.uri];
    } else
    {
        pp = parseDocument(doc,false);
    }
    if(pp)
    {
        for (var iSign=0;iSign<pp.funcList.length;iSign++)
        {
            var info = pp.funcList[iSign];
            if(info.kind != 'define') continue;
            if(info.name != w) continue
            return {contents: {  language: 'harbour', value: info.body }};
        }

        var thisDone = doc.uri in files;
        var includes = pp.includes;
        var i=0;
        var startDir = path.dirname(Uri.parse( doc.uri ).fsPath);
        while(i<includes.length)
        {
            var pInc = ParseInclude(startDir,includes[i],thisDone);
            if(pInc)
            {
                for (var iSign=0;iSign<pInc.funcList.length;iSign++)
                {
                    var info = pInc.funcList[iSign];
                    if(info.kind != 'define') continue;
                    if(info.name != w) continue
                    return {contents: {  language: 'harbour', value: info.body }};
                }
                for(var j=0;j<pInc.includes;j++)
                {
                    if(includes.indexOf(pInc.includes[j])<0)
                        includes.push(pInc.includes[j]); 
                }
            }
            i++;
            if(cancelled.isCancellationRequested) return server.CompletionList.create(completitions,false);
        }            
    }
    return undefined;
})



/*
connection.onDidChangeTextDocument(params => {
    var p = new provider.Provider();
    p.parseString(params.document.getText());
    
});
*/
connection.listen();