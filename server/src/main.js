const provider = require('./provider.js');
const server = require('vscode-languageserver')
const fs = require("fs");
const path = require("path");
const Uri = require("vscode-uri").URI;
const trueCase = require("true-case-path")
const server_textdocument = require("vscode-languageserver-textdocument");
const { SemanticTokenTypes } = require('vscode-languageserver');

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
/** @type {Object.<string, provider.Provider>} */
var files;
/** @type {Object.<string, provider.Provider>} */
var includes;
/** the list of documentation harbour base functions
 * @type {Array<object>} */
var docs;
/** the list of undocumented harbour base functions
 * @type {Array<string>} */
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
/** @type {boolean} */
var lineFoldingOnly;

var keywords = provider.keywords

/*
    every database contains a name (the text before the ->)
    and a list of field, objects with name (the text after the ->)
    and a files, array of string with the file where found the db.name->field.name
*/
connection.onInitialize(params => {
    canLocationLink = false;
    if (params.capabilities.textDocument &&
        params.capabilities.textDocument.declaration &&
        params.capabilities.textDocument.declaration.linkSupport)
        canLocationLink = true;
    lineFoldingOnly = true;
    if (params.capabilities.textDocument &&
        params.capabilities.textDocument.foldingRange &&
        lineFoldingOnly in params.capabilities.textDocument.foldingRange)
        lineFoldingOnly = params.capabilities.textDocument.foldingRange.lineFoldingOnly;

    if (params.capabilities.workspace && params.capabilities.workspace.workspaceFolders && params.workspaceFolders) {
        workspaceRoots = [];
        for (var i = 0; i < params.workspaceFolders.length; i++) {
            if (params.workspaceFolders[i].uri)
                workspaceRoots.push(params.workspaceFolders[i].uri)
        }
    } else {
        workspaceRoots = [params.rootUri]; //this deprecation is a false positive because it uses workspaceFolders right above here
        if (!workspaceRoots[0] && params.rootPath) {
            if (path.sep == "\\") //window
                workspaceRoots = ["file://" + encodeURI(params.rootPath.replace(/\\/g, "/"))];
            else
                workspaceRoots = ["file://" + encodeURI(params.rootPath)];
        }
        if (!workspaceRoots[0]) workspaceRoots = [];
    }
    fs.readFile(path.join(__dirname, 'hbdocs.json'), "utf8", (err, data) => {
        if (!err)
            docs = JSON.parse(data);
    });
    fs.readFile(path.join(__dirname, 'hbdocs.missing'), "utf8", (err, data) => {
        if (!err)
            missing = data.split(/\r\n{1,2}/g)
    });
    return {
        capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
            referencesProvider: true,
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
            hoverProvider: true,
            foldingRangeProvider: true,
            semanticTokensProvider: {
                legend: {
                    //tokenTypes: [
                    //    server.SemanticTokenTypes.class,
                    //    server.SemanticTokenTypes.method,
                    //    server.SemanticTokenTypes.property,
                    //    server.SemanticTokenTypes.function,
                    //    server.SemanticTokenTypes.parameter,
                    //    server.SemanticTokenTypes.variable,
                    //    server.SemanticTokenTypes.macro],
                    tokenTypes: [
                        server.SemanticTokenTypes.variable,
                        server.SemanticTokenTypes.parameter],
                    tokenModifiers: [
                        server.SemanticTokenModifiers.declaration,
                        server.SemanticTokenModifiers.static
                    ]
                },
                full: true
            }


        }
    }
});
/*
connection.workspace.onDidChangeWorkspaceFolders(params=>{
    var i=0;
})
*/
connection.onDidChangeConfiguration(params => {
    var searchExclude = params.settings.search.exclude;
    // minimatch
    includeDirs = params.settings.harbour.extraIncludePaths;
    includeDirs.splice(0, 0, ".")
    workspaceDepth = params.settings.harbour.workspaceDepth;
    wordBasedSuggestions = params.settings.editor.wordBasedSuggestions
    ParseWorkspace();

})

function ParseDir(dir, onlyHeader, depth, subirPaths) {
    if (!subirPaths) subirPaths = [];
    //fs.readdir(dir,{withFileTypes:true},function(err,ff)
    fs.readdir(dir, function (err, ff) {
        if (ff == undefined) return;
        for (var i = 0; i < ff.length; i++) {
            var fileName = ff[i];
            var completePath = path.join(dir, fileName);
            var info = fs.statSync(completePath);
            if (info.isFile()) {
                var ext = path.extname(fileName).toLowerCase();
                if (onlyHeader && ext != ".ch" && ext != ".h") {
                    continue;
                }
                var cMode = (ext.startsWith(".c") && ext != ".ch") || ext == ".h"
                if (cMode) {
                    var harbourFile = path.basename(fileName)
                    var pos = harbourFile.lastIndexOf(".");
                    harbourFile = harbourFile.substr(0, pos < 0 ? harbourFile.length : pos) + ".prg";
                    if (subirPaths.findIndex((v) => v.indexOf(harbourFile) >= 0) >= 0)
                        continue;
                }
                if (ext == ".prg" || ext == ".ch" || cMode) {
                    subirPaths.push(completePath);
                    var fileUri = Uri.file(completePath);
                    var pp = new provider.Provider(true);
                    pp.parseFile(completePath, fileUri.toString(), cMode).then(
                        prov => {
                            UpdateFile(prov)
                        }
                    )
                }
            } else if (info.isDirectory() && depth > 0) {
                ParseDir(path.join(dir, fileName), onlyHeader, depth - 1, subirPaths);
            }
        }
    });
}

function ParseWorkspace() {
    databases = {};
    files = {};
    includes = {};
    for (var i = 0; i < workspaceRoots.length; i++) {
        // other scheme of uri unsupported
        if (workspaceRoots[i] == null) continue;
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if (uri.scheme != "file") continue;
        ParseDir(uri.fsPath, false, workspaceDepth);
    }
    //for(var i=0;i<includeDirs.length;i++)
    //{
    //    ParseDir(includeDirs[i], true,0);
    //}
}

/**
 * Update a file in the workspace
 * @param {provider.Provider} pp
 */
function UpdateFile(pp) {
    var doc = pp.currentDocument;
    var ext = path.extname(pp.currentDocument).toLowerCase();
    if (ext != ".prg") {
        files[doc] = pp;
        return;
    }
    if (doc in files)
        for (var db in databases) {
            for (var f in databases[db].fields) {
                var idx = databases[db].fields[f].files.indexOf(doc);
                if (idx >= 0) {
                    databases[db].fields[f].files.splice(idx, 1);
                    if (databases[db].fields[f].files.length == 0) {
                        delete databases[db].fields[f];
                    }
                }
            }
            if (Object.keys(databases[db].fields).length == 0) {
                delete databases[db];
            }
        }
    files[doc] = pp;
    for (var db in pp.databases) {
        var ppdb = pp.databases[db];
        if (!(db in databases)) databases[db] = { name: ppdb.name, fields: {} };
        var gbdb = databases[db];
        for (var f in ppdb.fields) {
            if (!(f in gbdb.fields))
                gbdb.fields[f] = { name: ppdb.fields[f], files: [doc] };
            else {
                var idx = gbdb.fields[f].files.indexOf(doc);
                if (idx < 0) gbdb.fields[f].files.push(doc);
            }
        }
    }
    AddIncludes(path.dirname(doc), pp.includes);
}

function AddIncludes(startPath, includesArray) {
    if (includesArray.length == 0)
        return;
    if (startPath.startsWith("file:///"))
        startPath = Uri.parse(startPath).fsPath;
    function FindInclude(dir, fileName) {
        //var ext= path.extname(ff[fi]).toLowerCase();
        //if( ext != '.ch') return
        if (startPath && !path.isAbsolute(dir))
            dir = path.join(startPath, dir);
        if (!fs.existsSync(dir)) return false;
        if (fileName.length < 1)
            return false;
        var completePath = path.join(dir, fileName);
        if (!fs.existsSync(completePath)) return false;
        var info = fs.statSync(completePath);
        if (!info.isFile()) return false;
        var fileUri = Uri.file(completePath);
        try {
            fileUri = Uri.file(trueCase.trueCasePathSync(completePath));
        } catch(ex) { }
        var pp = new provider.Provider(true);
        includes[fileName] = pp;
        pp.parseFile(completePath, fileUri.toString(), false).then(
            prov => {
                includes[fileName] = prov;
                AddIncludes(dir, prov.includes);
            }
        )
        return true;
    }
    for (var j = 0; j < includesArray.length; j++) {
        var inc = includesArray[j];
        if (inc in includes)
            continue
        var found = false;
        for (var i = 0; i < workspaceRoots.length; i++) {
            // other scheme of uri unsupported
            /** @type {vscode-uri.default} */
            var uri = Uri.parse(workspaceRoots[i]);
            if (uri.scheme != "file") continue;
            found = FindInclude(uri.fsPath, inc);
            if (found) break;
        }
        if (found) continue;
        for (var i = 0; i < includeDirs.length; i++) {
            found = FindInclude(includeDirs[i], inc);
            if (found) break;
        }
    }
}

function ParseInclude(startPath, includeName, addGlobal) {
    if (includeName.length == 0)
        return undefined;
    if (includeName in includes)
        return includes[includeName];
    function FindInclude(dir) {
        if (startPath && !path.isAbsolute(dir))
            dir = path.join(startPath, dir);
        if (!fs.existsSync(dir)) return undefined;
        var test = path.join(dir, includeName);
        if (!fs.existsSync(test)) return undefined;
        var info = fs.statSync(test);
        if (!info.isFile()) return false;
        var pp = new provider.Provider();
        pp.parseString(fs.readFileSync(test).toString(), Uri.file(test).toString());
        if (addGlobal)
            includes[includeName] = pp;
        return pp;
    }
    for (var i = 0; i < workspaceRoots.length; i++) {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if (uri.scheme != "file") continue;
        var r = FindInclude(uri.fsPath);
        if (r) return r;
    }
    for (var i = 0; i < includeDirs.length; i++) {
        var r = FindInclude(includeDirs[i]);
        if (r) return r;
    }
}

function kindTOVS(kind, sk) {
    if (sk == undefined) sk = true;
    switch (kind) {
        case "class":
            return sk ? server.SymbolKind.Class : server.CompletionItemKind.Class;
        case "method":
            return sk ? server.SymbolKind.Method : server.CompletionItemKind.Method;
        case "data":
            return sk ? server.SymbolKind.Property : server.CompletionItemKind.Property;
        case "function*":
        case "procedure*":
            return sk ? server.SymbolKind.Interface : server.CompletionItemKind.Interface;
        case "function":
        case "procedure":
        case "C-FUNC":
            return sk ? server.SymbolKind.Function : server.CompletionItemKind.Function;
        case "local":
        case "static":
        case "public":
        case "private":
        case "param":
        case "memvar":
            return sk ? server.SymbolKind.Variable : server.CompletionItemKind.Variable;
        case "field":
            return sk ? server.SymbolKind.Field : server.CompletionItemKind.Field;
        case "define":
            return sk ? server.SymbolKind.Constant : server.CompletionItemKind.Constant;
    }
    return 0;
}

connection.onDocumentSymbol((param) => {
    var doc = documents.get(param.textDocument.uri);
    /** @type {provider.Provider} */
    var p = getDocumentProvider(doc);
    /** @type {server.DocumentSymbol[]} */
    var dest = [];
    for (var fn in p.funcList) {
        //if (p.funcList.hasOwnProperty(fn)) {
        /** @type {provider.Info} */
        var info = p.funcList[fn];
        if (info.kind == "field") continue;
        if (info.kind == "memvar") continue;
        var selRange = server.Range.create(info.startLine, info.startCol, info.endLine, info.endCol);
        if (info.endLine != info.startLine)
            selRange.end = server.Position.create(info.startLine, 1000);
        var docSym = server.DocumentSymbol.create(info.name,
            (info.comment && info.comment.length > 0 ? info.comment.replace(/[\r\n]+/g, " ") : ""),
            kindTOVS(info.kind),
            server.Range.create(info.startLine, info.startCol,
                info.endLine, info.endCol), selRange, undefined);
        var parent = dest;
        if (info.parent && info.startLine <= info.parent.endLine) {
            var pp = info.parent;
            var names = [];
            while (pp) {
                if (pp.kind == "method" && pp.foundLike == "definition" && (!pp.parent || pp.startLine > pp.parent.endLine)) {
                    if(pp.parent)
                        names.push(pp.parent.name + ":" + pp.name);

                    else if(pp.parentName)
                        names.push(pp.parentName+"???:" + pp.name);
                    else
                        names.push("???:" + pp.name);
                    break;
                } else
                    names.push(pp.name);
                pp = pp.parent;
            }
            while (names.length > 0) {
                var n = names.pop();
                var i = parent.findIndex((v) => (v.name == n));
                if (i >= 0) {
                    parent = parent[i];
                    if (!parent.children)
                        parent.children = [];
                    parent = parent.children;
                }
            }
        } else
            if (info.kind == "method") {
                if(info.parent)
                    docSym.name = info.parent.name + ":" + info.name
                else if(info.parentName)
                    docSym.name = info.parentName+"???:" + info.name;
                else
                    docSym.name = "???:" + info.name;
            }
        parent.push(docSym);
        //}
    };
    return dest;
});

function IsInside(word1, word2) {
    var ret = "";
    var i1 = 0;
    var lenMatch = 0, maxLenMatch = 0, minLenMatch = word1.length;
    for (var i2 = 0; i2 < word2.length; i2++) {
        if (word1[i1] == word2[i2]) {
            lenMatch++;
            if (lenMatch > maxLenMatch) maxLenMatch = lenMatch;
            ret += word1[i1];
            i1++;
            if (i1 == word1.length) {
                return ret;
            }
        } else {
            ret += "Z";
            if (lenMatch > 0 && lenMatch < minLenMatch)
                minLenMatch = lenMatch;
            lenMatch = 0;
        }
    }
    return undefined;
}

connection.onWorkspaceSymbol((param) => {
    var dest = [];
    var src = param.query.toLowerCase();
    var parent = undefined;
    var colon = src.indexOf(':');
    if (colon > 0) {
        parent = src.substring(0, colon);
        if (parent.endsWith("()")) parent = parent.substr(0, parent.length - 2);
        src = src.substr(colon + 1);
    }
    for (var file in files) { //if (files.hasOwnProperty(file)) {
        var pp = files[file];
        for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if (info.kind != "class" && info.kind != "method" &&
                info.kind != "data" && info.kind != "public" &&
                info.kind != "define" &&
                !info.kind.startsWith("procedure") &&
                !info.kind.startsWith("function"))
                continue;
            // workspace symbols takes statics too
            if (src.length > 0 && !IsInside(src, info.nameCmp))
                continue;
            // public has parent, but they are visible everywhere
            if (parent && info.kind != "public" && (!info.parent || !IsInside(parent, info.parent.nameCmp)))
                continue;
            dest.push(server.SymbolInformation.create(
                info.name, kindTOVS(info.kind),
                server.Range.create(info.startLine, info.startCol,
                    info.endLine, info.endCol),
                file, info.parent ? info.parent.name : ""));
            if (dest.length == 100)
                return dest;
        }
    }
    return dest;
});

function GetWord(params, withPrev) {
    var doc = documents.get(params.textDocument.uri);
    var pos = doc.offsetAt(params.position);
    var delta = 20;
    var word, prev;
    //var allText = doc.getText();
    var r = /\b[a-z_][a-z0-9_]*\b/gi
    while (true) {
        r.lastIndex = 0;
        //var text = allText.substr(Math.max(pos-delta,0),delta+delta)
        var text = doc.getText(server.Range.create(doc.positionAt(Math.max(pos - delta, 0)), doc.positionAt(pos + delta)));
        var txtPos = pos < delta ? pos : delta;
        while (word = r.exec(text)) {
            if (word.index <= txtPos && word.index + word[0].length >= txtPos)
                break;
        }
        if (!word) return [];
        if (word.index != 0 && (word.index + word[0].length) != (delta + delta)) {
            if(withPrev) {
                var idx = word.index-1;
                prev = text[idx];
                while(idx>=0 && (prev==' ' || prev=='\t')) {
                    prev = text[--idx];
                }
            }
            break
        }
        delta += 10;
    }
    var worldPos = pos - delta + word.index;
    word = word[0];
    return withPrev ? [word, prev, worldPos] : word;
}

connection.onDefinition((params) => {
    var doc = documents.get(params.textDocument.uri);
    var line = doc.getText(server.Range.create(params.position.line, 0, params.position.line, 100));
    var include = /^\s*#(?:pragma\s+__(?:c|binary)?stream)?include\s+[<"]([^>"]*)/i.exec(line);
    if (include !== null) {
        var startPath = undefined;
        if (params.textDocument.uri && params.textDocument.uri.startsWith("file")) {
            startPath = path.dirname(Uri.parse(params.textDocument.uri).fsPath);
        }
        var pos = include[0].indexOf(include[1]);
        return definitionFiles(include[1], startPath, server.Range.create(params.position.line, pos, params.position.line, pos + include[1].length));
    }
    var word = GetWord(params, true);
    if (word.length == 0) return undefined;
    var dest = [];
    var thisDone = false;
    var prev = word[1];
    var className;
    var pos = word[2];
    if (prev == ':' && doc.getText(server.Range.create(doc.positionAt(Math.max(pos - 3, 0)), doc.positionAt(pos))) == "():") {
        var tmp = params.position;
        params.position = doc.positionAt(Math.max(pos - 3, 0));
        className = GetWord(params).toLowerCase();
        params.position = tmp;
        var found = false;
        for (var file in files) { //if (files.hasOwnProperty(file)) {
            if (file == doc.uri) thisDone = true;
            pp = files[file];
            for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
                /** @type {provider.Info} */
                var info = pp.funcList[fn];
                if (info.kind != 'class')
                    continue
                if (info.nameCmp == className) {
                    found = true;
                    break;
                }
            }
        }
        var pThis
        if (!thisDone && !found) {
            pThis = getDocumentProvider(doc);
            for (var fn in pThis.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
                /** @type {provider.Info} */
                var info = pThis.funcList[fn];
                if (info.kind != 'class')
                    continue;
                if (info.nameCmp == className) {
                    found = true;
                    break;
                }
            }

        }
        if (!found) className = undefined;
    }

    word = word[0].toLowerCase();
    function DoProvider(pp, file) {
        for (var fn in pp.funcList) { //if (pp.funcList.hasOwnProperty(fn)) {
            /** @type {provider.Info} */
            var info = pp.funcList[fn];
            if (info.foundLike != "definition")
                continue;
            if (info.nameCmp != word)
                continue;
            if (info.kind.endsWith("*") && file != doc.uri)
                continue;
            if (info.kind == 'static' && file != doc.uri)
                continue;
            if (info.kind == 'data' || info.kind == 'method') {
                //if(prec!=':') continue;
                if (className && className != info.parent.nameCmp)
                    continue;
            }
            //if(info.kind=='field' && prec!='>')
            //    continue;
            if (info.kind == 'local' || info.kind == 'param') {
                if (file != doc.uri)
                    continue;
                var parent = info.parent;
                if (parent) {
                    if (parent.startLine > params.position.line)
                        continue;
                    if (parent.endLine < params.position.line)
                        continue;
                }
            }
            dest.push(server.Location.create(file,
                server.Range.create(info.startLine, info.startCol,
                    info.endLine, info.endCol)));
        }
    }
    for (var file in files) { //if (files.hasOwnProperty(file)) {
        if (file == doc.uri) thisDone = true;
        DoProvider(files[file], file);
    }
    var pThis
    if (!thisDone) {
        pThis = getDocumentProvider(doc);
        DoProvider(pThis, doc.uri);
    } else
        pThis = files[doc.uri];

    var includes = pThis.includes;
    var i = 0;
    var startDir = path.dirname(Uri.parse(doc.uri).fsPath);
    while (i < includes.length) {
        pp = ParseInclude(startDir, includes[i], thisDone);
        if (pp) {
            DoProvider(pp, pp.currentDocument)
            for (var j = 0; j < pp.includes; j++) {
                if (includes.indexOf(pp.includes[j]) < 0)
                    includes.push(pp.includes[j]);
            }
        }
        i++;
    }

    return dest;
})

connection.onSignatureHelp((params) => {
    var doc = documents.get(params.textDocument.uri);
    var pos = doc.offsetAt(params.position) - 1;
    /** @type {string} */
    var text = doc.getText();
    // backwards find (
    pos = findBracket(text, pos, -1, "(")
    if (pos === undefined) return pos;
    // Get parameter position
    var endPos = doc.offsetAt(params.position)
    var nC = CountParameter(text.substr(pos + 1, endPos - pos - 1), doc.offsetAt(params.position) - pos - 1)
    // Get the word
    pos--;
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    while (rge.test(text[pos])) {
        word = text[pos] + word;
        pos--;
    }
    word = word.toLowerCase();
    // special case for new, search the class name
    var prec = text.substring(pos - 2, pos + 1);
    if (prec == "():") // se è un metodo
    {
        pos -= 3;
        className = "";
        while (rge.test(text[pos])) {
            className = text[pos] + className;
            pos--;
        }
        className = className.toLowerCase();
    }
    var signatures = [].concat(getWorkspaceSignatures(word, doc, className, nC));
    if (signatures.length == 0 && className !== undefined) {
        signatures = [].concat(getWorkspaceSignatures(word, doc, undefined, nC));
    }
    signatures = signatures.concat(getStdHelp(word, nC));
    return { signatures: signatures, activeParameter: nC }
})

/**
 *
 * @param {String} text
 * @param {Number} pos
 * @param {Number} dir
 * @param {String} bracket
 */
function findBracket(text, pos, dir, bracket) {
    var nP = 0, str
    while (nP != 0 || text[pos] != bracket || str != undefined) {
        if (pos < 0) return undefined;
        if (pos >= text.length) return undefined;
        if (str) {
            if (text[pos] == str)
                str = undefined;
        } else {
            switch (text[pos]) {
                case '(': nP--; break;
                case ')': nP++; break;
                case '[': if (dir > 0) str = ']'; break
                case ']': if (dir < 0) str = '['; break
                case '{': if (dir > 0) str = '}'; break
                case '}': if (dir < 0) str = '{'; break
                case '"': str = '"'; break
                case "'": str = "'"; break
                case '\n':
                    var nSpace = 1;
                    while((pos - nSpace)>0 && text[pos - nSpace] != '\n') nSpace++;
                    var thisLine = text.substr(pos - nSpace + 1, nSpace)
                    thisLine = thisLine.replace(/\/\/[^\n]*\n/, "\n")
                    thisLine = thisLine.replace(/&&[^\n]*\n/, "\n")
                    thisLine = thisLine.replace(/\s+\n/, "\n")
                    if (thisLine[thisLine.length - 2] == ';')
                        break;
                    return undefined;
                    break;
            }
        }
        pos += dir;
    }
    return pos
}

/**
 *
 * @param {String} txt The text where count the parameter
 * @param {Number} position Position of cursor
 */
function CountParameter(txt, position) {
    var i = 0;
    while (true) {
        i++;
        var filter = undefined;
        switch (i) {
            case 1: filter = /;\s*\r?\n/g; break;  // new line with ;
            case 2: filter = /'[^']*'/g; break; // ' strings
            case 3: filter = /"[^"]*"/g; break; // " strings
            case 4: filter = /\[[^\[\]]*\]/g; break; // [] strings or array index
            case 5: filter = /{[^{}]*}/g; break; // {} array
            case 6: filter = /\([^\(\)]*\)/g; break; // couple of parenthesis
        }
        if (filter == undefined)
            break;
        do {
            var someChange = false
            txt = txt.replace(filter, function (matchString) {
                someChange = true;
                return Array(matchString.length + 1).join("X");
            })
        } while (someChange)
    }
    return (txt.substr(0, position).match(/,/g) || []).length
}

function getWorkspaceSignatures(word, doc, className, nC) {
    var signatures = [];
    var thisDone = false;
    function GetSignatureFromInfo(pp, info) {
        if ("hDocIdx" in info) return GetHelpFromDoc(pp.harbourDocs[info.hDocIdx]);
        var s = {}
        if (info.kind.startsWith("method"))
            if (info.parent) {
                s["label"] = info.parent.name + ":" + info.name;
                if (className && className != info.parent.nameCmp) return undefined;
            }
            else {
                s["label"] = "??:" + info.name;
                if (className) return undefined;
            }
        else
            s["label"] = info.name;
        s["label"] += "("
        var subParams = [];
        for (var iParam = iSign + 1; iParam < pp.funcList.length; iParam++) {
            /** @type {provider.Info} */
            var subinfo = pp.funcList[iParam];
            if (subinfo.parent == info && subinfo.kind == "param") {
                var pInfo = { "label": subinfo.name }
                if (subinfo.comment && subinfo.comment.trim().length > 0)
                    pInfo["documentation"] = "<" + subinfo.name + "> " + subinfo.comment
                subParams.push(pInfo)
                if (!s.label.endsWith("("))
                    s.label += ", "
                s.label += subinfo.name
            } else
                break;
        }
        s["label"] += ")"
        s["parameters"] = subParams;
        if (info.comment && info.comment.trim().length > 0)
            s["documentation"] = info.comment
        return s;
    }
    for (var file in files) //if (files.hasOwnProperty(file))
    {
        if (file == doc.uri) thisDone = true;
        var pp = files[file];
        for (var iSign = 0; iSign < pp.funcList.length; iSign++) {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if (!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if (info.nameCmp != word)
                continue;
            if (info.kind.endsWith("*") && file != doc.uri)
                continue;
            var s = GetSignatureFromInfo(pp, info);
            if (s && s["parameters"].length >= nC)
                signatures.push(s);
        }
    }
    if (!thisDone) {
        var pp = getDocumentProvider(doc);
        for (var iSign = 0; iSign < pp.funcList.length; iSign++) {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if (!info.kind.startsWith("method") && !info.kind.startsWith("procedure") && !info.kind.startsWith("function"))
                continue;
            if (info.nameCmp != word)
                continue;
            var s = GetSignatureFromInfo(pp, info);
            if (s && s["parameters"].length >= nC)
                signatures.push(s);
        }

    }
    return signatures;
}

function GetHelpFromDoc(doc) {
    var s = {};
    s["label"] = doc.label;
    s["documentation"] = doc.documentation;
    var subParams = [];
    for (var iParam = 0; iParam < doc.arguments.length; iParam++) {
        subParams.push({
            "label": doc.arguments[iParam].label,
            "documentation": doc.arguments[iParam].documentation
        });
    }
    s["parameters"] = subParams;
    return s;
}

function getStdHelp(word, nC) {
    var signatures = [];
    for (var i = 0; i < docs.length; i++) {
        if (docs[i].name.toLowerCase() == word) {
            signatures.push(GetHelpFromDoc(docs[i]));
        }
    }
    return signatures;
}

var documents = new server.TextDocuments(server_textdocument.TextDocument);
documents.listen(connection);

documents.onDidChangeContent((e) => {
    var uri = Uri.parse(e.document.uri);
    if (uri.scheme != "file") return;
    var found = false;
    for (var i = 0; i < workspaceRoots.length; i++)
        if (e.document.uri.startsWith(workspaceRoots[i]))
            found = true;
    if (!found) return; //not include file outside the current workspace
    var ext = path.extname(uri.fsPath).toLowerCase();
    var cMode = (ext.startsWith(".c") && ext != ".ch")
    if (ext == ".prg" || ext == ".ch" || cMode) {
        var doGroups = false;
        if (uri in files) doGroups = files[uri].doGroups;
        var pp = parseDocument(e.document, (p) => { p.cMode = cMode; p.doGroups = doGroups; })
        UpdateFile(pp);
    }
})

/**
 *
 * @param {server_textdocument.TextDocument} doc
 * @param {boolean} cMode
 * @returns {provider.Provider}
 */
function parseDocument(doc, onInit) {
    var pp = new provider.Provider(false)
    pp.Clear();
    pp.currentDocument = doc.uri;
    if (onInit != undefined) onInit(pp);
    for (var i = 0; i < doc.lineCount; i++) {
        pp.parse(doc.getText(server.Range.create(i, 0, i, 1000)));
    }
    pp.endParse();
    return pp;
}

/** @type {provider.Provider} */
var lastDocOutsideWorkspaceProvider = { currentDocument: "" };
function getDocumentProvider(doc, checkGroup) {
    var pp;
    if (doc.uri in files) {
        pp = files[doc.uri]
        if (checkGroup && !pp.doGroups)
            pp = files[doc.uri] = parseDocument(doc, (p) => p.doGroups = true);
        return pp;
    }
    if(doc.uri in includes) {
        return includes[doc.uri]
    }
    if (doc.uri == lastDocOutsideWorkspaceProvider.currentDocument) {
        pp = lastDocOutsideWorkspaceProvider;
        if (checkGroup && !pp.doGroups)
            pp = lastDocOutsideWorkspaceProvider = parseDocument(doc, (p) => p.doGroups = true);
        return pp;
    }
    if (checkGroup)
        pp = lastDocOutsideWorkspaceProvider = parseDocument(doc, (p) => p.doGroups = true);
    else
        pp = lastDocOutsideWorkspaceProvider = parseDocument(doc);
    return pp;
}

connection.onCompletion((param, cancelled) => {
    var doc = documents.get(param.textDocument.uri);
    var line = doc.getText(server.Range.create(param.position.line, 0, param.position.line, 1000));
    var include = /^\s*#(pragma\s+__(?:c|binary)?stream)?include\s+[<"]([^>"]*)/i.exec(line);
    var precLetter = doc.getText(server.Range.create(server.Position.create(param.position.line, param.position.character - 1), param.position));
    if (include !== null) {
        if (precLetter == '>') {
            return server.CompletionList.create([], false); // wrong call
        }
        var startPath = undefined;
        if (param.textDocument.uri && param.textDocument.uri.startsWith("file")) {
            startPath = path.dirname(Uri.parse(param.textDocument.uri).fsPath)
        }
        var includePos = line.lastIndexOf(include[2]);
        return completionFiles(include[2], startPath, include[1]!=undefined,
            server.Range.create(server.Position.create(param.position.line, includePos),
                server.Position.create(param.position.line, includePos + include[2].length - 1)));
    }
    var allText = doc.getText();
    var completions = [];
    var pos = doc.offsetAt(param.position) - 1
    // Get the word
    var rge = /[0-9a-z_]/i;
    var word = "", className = undefined;
    var pp = getDocumentProvider(doc);
    while (pos >= 0 && rge.test(allText[pos])) {
        word = allText[pos] + word;
        pos--;
    }
    word = word.toLowerCase();
    var precLetter = allText[pos];
    if (precLetter == '>') {
        if (allText[pos - 1] == '-') {
            precLetter = '->';
            completions = CompletionDBFields(word, allText, pos, pp)
            if (completions.length > 0)
                return server.CompletionList.create(completions, true); // put true because added all known field of this db
        } else {
            return server.CompletionList.create([], false); // wrong call
        }
    }
    var done = {}
    function CheckAdd(label, kind, sort) {
        var ll = label.toLowerCase()
        if (ll in done)
            return;
        done[ll] = true;
        var sortLabel = IsInside(word, ll);
        if (sortLabel === undefined)
            return undefined;
        //var c =completions.find( (v) => v.label.toLowerCase() == ll );
        //if(!c)
        {
            c = server.CompletionItem.create(label);
            c.kind = kind
            c.sortText = sort + sortLabel
            completions.push(c);
        }
        return c;
    }
    if (precLetter != '->' && precLetter != ':') precLetter = undefined;
    if (word.length == 0 && precLetter == undefined) return server.CompletionList.create(completions, false);
    if (!precLetter) {
        for (var dbName in databases) {
            CheckAdd(databases[dbName].name, server.CompletionItemKind.Struct, "AAAA")
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
        if (pp) {
            for (var dbName in pp.databases) {
                CheckAdd(pp.databases[dbName].name, server.CompletionItemKind.Struct, "AAAA")
                if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
            }
        }
    }
    function GetCompletions(pp, file) {
        for (var iSign = 0; iSign < pp.funcList.length; iSign++) {
            /** @type {provider.Info} */
            var info = pp.funcList[iSign];
            if (word.length > 0 && !IsInside(word, info.nameCmp))
                continue;
            if (info.endCol == param.position.character && info.endLine == param.position.line && file == doc.uri)
                continue;
            if (precLetter == '->' && info.kind != "field")
                continue;
            if (precLetter != '->' && info.kind == "field")
                continue;
            if (precLetter == ':' && info.kind != "method" && info.kind != "data")
                continue;
            if (precLetter != ':' && (info.kind == "method" || info.kind == "data"))
                continue;
            if (info.kind == "function*" || info.kind == "procedure*" || info.kind == "static") {
                if (file != doc.uri)
                    continue;
            }
            //if(info.kind == "local" || info.kind == "param")
            if (info.parent && (info.parent.kind.startsWith("function") || info.parent.kind.startsWith("procedure") || info.parent.kind == 'method')) {
                if (file != doc.uri) continue;
                if (param.position.line < info.parent.startLine ||
                    param.position.line > info.parent.endLine)
                    continue;
            }
            var added = CheckAdd(info.name, kindTOVS(info.kind, false), "AAA");
            if (added && (info.kind == "method" || info.kind == "data") && info.parent)
                added.documentation = info.parent.name;
            if (cancelled.isCancellationRequested) return
        }
    }
    for (var file in files) // if (files.hasOwnProperty(file)) it is unnecessary
    {
        GetCompletions(files[file], file);
        if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
    }
    if (pp) {
        GetCompletions(pp, doc.uri);
    } else if (doc.uri in files) {
        pp = files[doc.uri]
    }
    if (pp) {
        var thisDone = doc.uri in files;
        var includes = pp.includes;
        var i = 0;
        var startDir = path.dirname(Uri.parse(doc.uri).fsPath);
        while (i < includes.length) {
            pInc = ParseInclude(startDir, includes[i], thisDone);
            if (pInc) {
                GetCompletions(pInc, pInc.currentDocument)
                for (var j = 0; j < pInc.includes; j++) {
                    if (includes.indexOf(pInc.includes[j]) < 0)
                        includes.push(pInc.includes[j]);
                }
            }
            i++;
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
    }
    if (precLetter != ':' && precLetter != '->') {
        for (var i = 0; i < docs.length; i++) {
            var c = CheckAdd(docs[i].name, server.CompletionItemKind.Function, "AA")
            if (c) c.documentation = docs[i].documentation;
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
        for (var i = 1; i < keywords.length; i++) {
            CheckAdd(keywords[i], server.CompletionItemKind.Keyword, "AAA")
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
        for (var i = 1; i < missing.length; i++) {
            CheckAdd(missing[i], server.CompletionItemKind.Function, "A")
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
        //AddCommands(param, completions)
    }
    if (wordBasedSuggestions) {
        var wordRE = /\b[a-z_][a-z0-9_]*\b/gi
        var foundWord;
        var pos = doc.offsetAt(param.position);
        while (foundWord = wordRE.exec(allText)) {
            // remove current word
            if (foundWord.index < pos && foundWord.index + foundWord[0].length >= pos)
                continue;
            CheckAdd(foundWord[0], server.CompletionItemKind.Text, "")
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completions, false);
        }
    }
    return server.CompletionList.create(completions, false);
})

/**
 * @param {server.CompletionParams} param
 * @param {server.CompletionItem[]} completions
 * */
function AddCommands(param, completions) {
    var doc = documents.get(param.textDocument.uri);
    var line = doc.getText(server.Range.create(param.position.line,0,param.position.line,1000));
    var nextLine = line;
    var contTest = /;(\/\*.*\*\/)*((\/\/|&&).*)?[\r\n]{1,2}$/;
    var startLine=param.position.line;
    var endLine=param.position.line;
    var i=1;
    while((param.position.line-i)>0) {
        var precLine=doc.getText(server.Range.create(param.position.line-i,0,param.position.line-i,1000));
        if(precLine.match(contTest)) {
            line = precLine+line;
            startLine = param.position.line-i;
            i++;
        } else
            break;
    }
    i=1;
    while(nextLine.match(contTest)) {
        nextLine = doc.getText(server.Range.create(param.position.line+i,0,param.position.line+i,1000));
        line += nextLine;
        endLine = param.position.line+i;
        i++;
    }
    const thisInfo = getDocumentProvider(doc);
    for(var i=0;i<thisInfo.commands.length;i++) {
        const thisCommand = thisInfo.commands[i];
        if(line.match(thisCommand.regEx)) {
            for(var j=0;thisCommand.length; j++) {
                const thisPart = thisCommand[j];
                //completitions.
            }
        }
    }
}


/**
 *
 * @param {string} word
 * @param {string} startPath
 * @param {server.Range} includeRange
 */
function completionFiles(word, startPath, allFiles, includeRange) {
    var completitons = [], foundSlash=path.sep;
    word = word.replace("\r", "").replace("\n", "");
    var startDone = false;
    var deltaPath = ""
    var lastSlash = Math.max(word.lastIndexOf("\\"), word.lastIndexOf("/"))
    if (lastSlash > 0) {
        foundSlash = word.substr(lastSlash,1)
        deltaPath = word.substr(0, lastSlash);
        word = word.substr(lastSlash + 1);
    }
    if (process.platform.startsWith("win")) {
        word = word.toLowerCase();
        if (startPath) startPath = startPath.toLowerCase();
    }
    var dirDone = [];
    function CheckDir(dir) {
        if (startPath && !path.isAbsolute(dir))
            dir = path.join(startPath, dir);
        dir = path.join(dir, deltaPath);
        if (process.platform.startsWith("win")) {
            if (dirDone.indexOf(dir.toLowerCase()) >= 0)
                return;
            dirDone.push(dir.toLowerCase());
        } else {
            if (dirDone.indexOf(dir) >= 0)
                return;
            dirDone.push(dir);
        }
        if (!fs.existsSync(dir)) return;

        if (startPath && dir.toLowerCase() == startPath) startDone = true;
        var ff = fs.readdirSync(dir)
        /** @type {Array<String>} */
        var subfiles;
        var extRE = /\.c?h$/i;
        for (var fi = 0; fi < ff.length; fi++) {
            var fileName = ff[fi];
            if (process.platform.startsWith("win"))
                fileName = fileName.toLowerCase();
            var completePath = path.join(dir, ff[fi]);
            var info = fs.statSync(completePath);
            if (info.isDirectory()) {
                subfiles = fs.readdirSync(completePath);
                if (!allFiles && subfiles.findIndex((v) => extRE.test(v)) == -1)
                    continue;
            } else if (!allFiles && !extRE.test(ff[fi]))
                continue;
            var sortText = undefined;
            if (word.length != 0) {
                sortText = IsInside(word, fileName);
                if (!sortText)
                    continue;
            }
            var result = path.join(deltaPath, ff[fi]).replace(new RegExp("\\"+path.sep,"g"),foundSlash);
            var c = server.CompletionItem.create(result);
            c.kind = info.isDirectory() ? server.CompletionItemKind.Folder : server.CompletionItemKind.File;
            c.sortText = sortText ? sortText : ff[fi];
            c.detail = dir;
            c.textEdit = server.TextEdit.replace(includeRange, result);
            completitons.push(c);
        }
    }

    for (var i = 0; i < workspaceRoots.length; i++) {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if (uri.scheme != "file") continue;
        CheckDir(uri.fsPath);
    }
    for (var i = 0; i < includeDirs.length; i++) {
        CheckDir(includeDirs[i]);
    }
    if (startPath && !startDone) {
        CheckDir(startPath);
    }
    return server.CompletionList.create(completitons, false);
}

function definitionFiles(fileName, startPath, origin) {
    var dest = [];
    fileName = fileName.toLowerCase();
    var startDone = false;
    if (startPath) startPath = startPath.toLowerCase();
    var emptyRange = server.Range.create(0, 0, 0, 0);
    function DefDir(dir) {
        if (startPath && !path.isAbsolute(dir))
            dir = path.join(startPath, dir);
        if (!fs.existsSync(dir)) return;
        if (startPath && dir.toLowerCase() == startPath) startDone = true;
        if(fs.existsSync(path.join(dir, fileName))) {
            var fileUri = path.join(dir, fileName);
            try {
                fileUri = trueCase.trueCasePathSync(fileUri);
            } catch(ex) {}
            fileUri = Uri.file(fileUri);
            fileUri = fileUri.toString();
            if (canLocationLink)
                dest.push(server.LocationLink.create(fileUri, emptyRange, emptyRange, origin));
            else
                dest.push(server.Location.create(fileUri, emptyRange));
        }
    }
    for (var i = 0; i < workspaceRoots.length; i++) {
        // other scheme of uri unsupported
        /** @type {vscode-uri.default} */
        var uri = Uri.parse(workspaceRoots[i]);
        if (uri.scheme != "file") continue;
        DefDir(uri.fsPath);
    }
    for (var i = 0; i < includeDirs.length; i++) {
        DefDir(includeDirs[i]);
    }
    if (startPath && !startDone) {
        DefDir(startPath);
    }
    return dest;
}

function CompletionDBFields(word, allText, pos, pp) {
    //precLetter = '->';
    var pdb = pos - 2;
    var dbName = "";
    var nBracket = 0;
    while ((allText[pdb] != ' ' && allText[pdb] != '\t') || nBracket > 0) {
        var c = allText[pdb];
        pdb--;
        if (c == ')') nBracket++;
        if (c == '(') nBracket--;
        //dbName = c + dbName;
    }
    dbName = allText.substring(pdb+1,pos-1).replace(/\s+/g,"")
    var completitions = [];
    function AddDB(db) {
        for (var f in db.fields) {
            var name = db.fields[f];
            if (typeof (name) != "string") name = name.name;
            var sortText = name;
            if (word.length > 0) {
                sortText = IsInside(word, f);
            }
            if (!sortText) continue;
            if (!completitions.find((v) => v.label.toLowerCase() == name.toLowerCase())) {
                var c = server.CompletionItem.create(name);
                c.kind = server.CompletionItemKind.Field;
                c.documentation = db.name;
                c.sortText = "AAAA" + sortText;
                completitions.push(c);
            }
        }
    }
    function CheckDB(databases) {
        if (!(dbName in databases)) {
            // check if pick too much text
            for (db in databases) {
                if (dbName.endsWith(db)) {
                    dbName = db;
                    break
                }
            }
        }
        if (dbName in databases) {
            AddDB(databases[dbName]);
        }
    }
    dbName = dbName.toLowerCase().replace(" ", "").replace("\t", "");
    if (dbName.toLowerCase() == "field") {
        for (db in databases) AddDB(databases[db]);
        if (pp) for (db in pp.databases) AddDB(pp.databases[db]);
    } else {
        CheckDB(databases);
        if (pp && dbName in pp.databases) {
            CheckDB(pp.databases);
        }
    }
    return completitions;
}

connection.onHover((params, cancelled) => {
    var w = GetWord(params);
    var doc = documents.get(params.textDocument.uri);
    var pp = getDocumentProvider(doc);
    if(w.length==0) return undefined;
    if (pp) {
        var result = pp.funcList.filter((v)=> v.kind=='define' && v.name==w);
        if(result.length>0) {
            return { contents: { language: 'harbour', value: result[0].body } };
        }
        var thisDone = doc.uri in files;
        var includes = pp.includes;
        var i = 0;
        var startDir = path.dirname(Uri.parse(doc.uri).fsPath);
        while (i < includes.length) {
            var pInc = ParseInclude(startDir, includes[i], thisDone);
            if (pInc) {
                var result = pInc.funcList.filter((v)=> v.kind=='define' && v.name==w);
                if(result.length>0) {
                    return { contents: { language: 'harbour', value: result[0].body } };
                }
                for (var j = 0; j < pInc.includes.length; j++) {
                    if (includes.indexOf(pInc.includes[j]) < 0)
                        includes.push(pInc.includes[j]);
                }
            }
            i++;
            if (cancelled.isCancellationRequested) return server.CompletionList.create(completitions, false);
        }
    }
    return undefined;
})

connection.onFoldingRanges((params) => {
    var ranges = [];
    var doc = documents.get(params.textDocument.uri);
    var pp = getDocumentProvider(doc, true);
    for (var iSign = 0; iSign < pp.funcList.length; iSign++) {
        /** @type {provider.Info} */
        var info = pp.funcList[iSign];
        if (info.startLine != info.endLine) {
            var rr = {};
            rr.startLine = info.startLine;
            rr.endLine = info.endLine;
            ranges.push(rr);
        }
    }
    var deltaLine = 0;
    if (lineFoldingOnly) deltaLine = 1;
    for (let iGroup = 0; iGroup < pp.groups.length; iGroup++) {
        /** @type {provider.KeywordPos[]} */
        var poss = pp.groups[iGroup].positions;
        if (["if", "try", "sequence", "case"].indexOf(pp.groups[iGroup].type) < 0) {
            var rr = {};
            var i = poss.length - 1;
            rr.startLine = poss[0].line;
            rr.endLine = poss[i].line - deltaLine;
            rr.startCharacter = poss[0].endCol;
            rr.endCharacter = poss[i].startCol;
            ranges.push(rr);
        } else {
            var prec = 0;
            for (let i = 1; i < poss.length; i++) {
                if (poss[i].text != "exit") {
                    var rr = {};
                    rr.startLine = poss[prec].line;
                    rr.endLine = poss[i].line - deltaLine;
                    rr.startCharacter = poss[prec].endCol;
                    rr.endCharacter = poss[i].startCol;
                    ranges.push(rr);
                    prec = i;
                }
            }
        }
    }
    for (var iGroup = 0; iGroup < pp.preprocGroups.length; iGroup++) {
        /** @type {provider.KeywordPos[]} */
        var poss = pp.preprocGroups[iGroup].positions;
        var rr = {};
        var i = poss.length - 1;
        rr.startLine = poss[0].line;
        rr.endLine = poss[i].line - deltaLine;
        rr.startCharacter = poss[0].endCol;
        rr.endCharacter = poss[i].startCol;
        ranges.push(rr);
    }
    for (let iComment = 0; iComment < pp.multilineComments.length; iComment++) {
        const cc = pp.multilineComments[iComment];
        var rr = {};
        rr.king = "comment"
        rr.startLine = cc[0];
        rr.endLine = cc[1];
        ranges.push(rr);
    }
    for (let iCFolder = 0; iCFolder < pp.cCodeFolder.length; iCFolder++) {
        const folder = pp.cCodeFolder[iCFolder];
        var rr = {};
        rr.startLine = folder[0]
        rr.endLine = folder[2] - deltaLine;
        rr.startCharacter = folder[1];
        rr.endCharacter = folder[3];
        ranges.push(rr);

    }

    return ranges;
})

connection.onRequest("harbour/groupAtPosition", (params) => {
    var doc = documents.get(params.textDocument.uri);
    if(!doc) return [];
    var pp = getDocumentProvider(doc, true);
    for (var iGroup = 0; iGroup < pp.groups.length; iGroup++) {
        /** @type {Array<provider.KeywordPos>} */
        var poss = pp.groups[iGroup].positions;
        for (var i = 0; i < poss.length; i++) {
            if (params.sel.active.line == poss[i].line &&
                params.sel.active.character >= poss[i].startCol &&
                params.sel.active.character <= poss[i].endCol) {
                return poss;
            }
        }
    }
    return [];
})

connection.onRequest("harbour/docSnippet", (params) => {
    var doc = documents.get(params.textDocument.uri);
    var pp = getDocumentProvider(doc);
    /** @type{provider.Info} */
    var funcInfo, iSign;
    for (let i = 0; i < pp.funcList.length; i++) {
        /** @type{provider.Info} */
        const info = pp.funcList[i];
        if (!info.kind.startsWith("procedure") &&
            !info.kind.startsWith("function"))
            continue;
        if (info.startLine > params.sel[0].line) {
            funcInfo = info;
            iSign = i;
            break;
        }
    }
    if (!funcInfo) return undefined;
    if ("hDocIdx" in funcInfo) return undefined;
    var subParams = [];
    for (var iParam = iSign + 1; iParam < pp.funcList.length; iParam++) {
        /** @type {provider.Info} */
        var subinfo = pp.funcList[iParam];
        if (subinfo.parent == funcInfo && subinfo.kind == "param") {
            subParams.push(subinfo);
        } else
            break;
    }

    var snipppet = "/* \\$DOC\\$\r\n";
    snipppet += "\t\\$TEMPLATE\\$\r\n\t\t" + funcInfo.kind + "\r\n";
    snipppet += "\t\\$ONELINER\\$\r\n\t\t$1\r\n"
    snipppet += "\t\\$SYNTAX\\$\r\n\t\t" + funcInfo.name + "("
    for (let iParam = 0; iParam < subParams.length; iParam++) {
        const param = subParams[iParam];
        snipppet += "<" + param.name + ">";
        if (iParam != subParams.length - 1) snipppet += ", "
    }
    if (funcInfo.kind.startsWith("function"))
        snipppet += ") --> ${2:retValue}\r\n"
    else
        snipppet += ")\r\n"
    snipppet += "\t\\$ARGUMENTS\\$\r\n"
    var nTab = 3;
    for (let iParam = 0; iParam < subParams.length; iParam++) {
        const param = subParams[iParam];
        snipppet += "\t\t<" + param.name + "> $" + nTab + "\r\n";
        nTab++;
    }
    if (funcInfo.kind.startsWith("function")) {
        snipppet += "\t\\$RETURNS\\$\r\n"
        snipppet += "\t\t${2:retValue} $" + nTab + "\r\n"
    }
    snipppet += "\t\\$END\\$ */"
    return snipppet;
    })

connection.onRequest(server.SemanticTokensRegistrationType.method, (param)=> {
    var doc = documents.get(param.textDocument.uri);
    if(!doc) return [];
    var ret = [];
    var pp = getDocumentProvider(doc);
    for (let i = 0; i < pp.funcList.length; i++) {
        /** @type{provider.Info} */
        const info = pp.funcList[i];
        if((info.kind=="local" || info.kind=="param")&&(info.nameCmp in pp.references)) {
            const id = info.kind=="local"? 0 : 1;
            const p = info.parent;
            for (let ri = 0; ri < pp.references[info.nameCmp].length; ri++) {
                const ref = pp.references[info.nameCmp][ri];
                if(ref.type == "variable" &&
                    ref.line>=p.startLine &&
                    ref.line<=p.endLine) {
                        var mod = 0;
                        if(ref.line == info.startLine) mod+=1;
                        ret.push([ref.line,ref.col,info.nameCmp.length,id,mod])
                    }
            }
        }
        if (info.kind=="static" && info.nameCmp in pp.references) {
            const id = 0;
            for (let ri = 0; ri < pp.references[info.nameCmp].length; ri++) {
                const ref = pp.references[info.nameCmp][ri];
                if(ref.type == "variable") {
                    var mod = 2; //static
                    if(ref.line == info.startLine) mod+=1;
                    ret.push([ref.line,ref.col,info.nameCmp.length,id,mod])
                }
            }
        }
    }
    ret = ret.sort((a,b) => a[0]!=b[0] ? a[0]-b[0] : a[1]-b[1])
    for(let i=ret.length-1;i>0;--i) {
        if(ret[i][0]!=ret[i-1][0]) {
            //different lines
            ret[i][0] -= ret[i-1][0];
        } else {
            ret[i][0] = 0;
            ret[i][1] -= ret[i-1][1]
        }
    }
    ret=ret.flat()
    return { "data": ret}
});

/**
 *
 * @param {server_textdocument.TextDocument} doc
 * @param {number} startPos
 */
function getNextNotSpace(doc,startPos) {

    var p;
    var currPos, endPos = doc.positionAt(startPos);
    do {
        currPos = endPos;
        startPos+=10;
        endPos = doc.positionAt(startPos);
        if(endPos.line==currPos.line && endPos.character==currPos.character)
            return "";
        p = doc.getText(server.Range.create(currPos,endPos)).trimStart();
    } while(p.length==0 && endPos.line<=doc.lineCount)
    return p[0];
}

connection.onReferences( (params) => {
    var word = GetWord(params, true);
    if (word.length == 0) return undefined;
    var doc = documents.get(params.textDocument.uri);
    var prev = word[1]
    var next = getNextNotSpace(doc,word[2]+word[0].length)
    var kind = "variable"
    if(prev==':') kind= next=="("? "method" : "data";
             else  kind= next=="("? "function" : "variable";
    if(prev==">") kind="field"
    var ret = [];
    word = word[0].toLowerCase()
    var pThis;
    if(doc.uri in files)
        pThis = files[doc.uri];
    else
        pThis = getDocumentProvider(doc);
    var reqLine = params.position.line
    var def = pThis.funcList.find((v)=>
        v.nameCmp==word &&
        (v.parent==undefined || (v.parent.startLine<=reqLine && v.parent.endLine>=reqLine)));
    var onlyThis = false;
    if(def) {
        if(def.kind.endsWith("*")) onlyThis = true;
        if(def.kind == "local") onlyThis = true;
        if(def.kind == "static") onlyThis = true;
        if(def.kind == "param") onlyThis = true;
    }
    if(word in pThis.references) { //always
        for (let i = 0; i < pThis.references[word].length; i++) {
            /** @type {provider.reference} */
            const ref = pThis.references[word][i];
            if(ref.type!=kind) continue;
            if(def && def.parent) {
                if(ref.line<def.parent.startLine) continue;
                if(ref.line>def.parent.endLine) continue;
            }
            ret.push(server.Location.create(doc.uri,
                server.Range.create(ref.line,ref.col,ref.line,ref.col+word.length)))
        }
    }

    if(!onlyThis) for (var file in files) { //if (files.hasOwnProperty(file)) {
        if (file == doc.uri) continue;
        var pp = files[file];
        if(word in pp.references) {
            for (let i = 0; i < pp.references[word].length; i++) {
                /** @type {provider.reference} */
                const ref = pp.references[word][i];
                if(ref.type==kind) {
                    ret.push(server.Location.create(file,
                        server.Range.create(ref.line,ref.col,ref.line,ref.col+word.length)))
                }
            }
        }
    }
    return ret;
})


//connection.onDocumentFormatting =

connection.listen();