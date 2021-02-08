const fs = require("fs");
const readline = require("readline");

// beta feature
const commandPartsingEnabled = false;

const procRegEx = /\s*((?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+([a-z_][a-z0-9_]*)\s*(?:\(([^\)]*)\))?/i;
const methodRegEx = /\s*(meth(?:o(?:d)?)?)\s+(?:(?:(?:proc(?:e(?:d(?:u(?:r(?:e)?)?)?)?)?)|func(?:t(?:i(?:o(?:n)?)?)?)?)\s+)?([a-z_][a-z0-9_]*)\s*(?:\(([^\)]*)\))?(?:\s*class\s+([a-z_][a-z0-9_]*))?(\s+inline)?/i
const defineRegEx = /\s*(#\s*define)\s+([^\s\(]+)(?:\(([^\)]*)\))?(\s+.*)?/i;
const hb_funcRegEx = /HB_FUNC\s*\(\s*([A-Z0-9_]+)\s*\)/
function Provider(light) {
    // *********** options
    this.light = light !== undefined ? light : false;
    this.doGroups = false;

    this.Clear();

    this.__defineGetter__("lastComment", () => {
        return this.removedComments[this.removedComments.length - 1].value;
    })
    this.__defineSetter__("lastComment", (v) => {
        var dest = this.removedComments[this.removedComments.length - 1];
        if (dest.line < 0) dest.line = this.lineNr;
        //if(v.startsWith("\r\n")) v=v.substr(2);
        return dest.value = v;
    })
    this.__defineSetter__("lastCommentPos", (v) => {
        return this.removedComments[this.removedComments.length - 1].pos = v;
    })
}


Provider.prototype.Clear = function () {
    // *********** data used during the parsing
    /** @type {boolean} is true for multi line comments */
    this.comment = false;
    /** @type {boolean} is true for pragma text */
    this.pragmaText = false;
    /** @type {string} current line parsing, with string and comments */
    this.currLinePreProc = "";
    /** @type {string} current line parsing, without string and comments */
    this.currLine = "";
    /** @type {number} current line number */
    this.lineNr = -1;
    /** @type {number} for statemente that continues on next line, it indicates the first */
    this.startLine = 0;
    /** @type {number} last line number not empty after removing all comments */
    this.lastCodeLine = 0;
    /** @type {boolean} is true if parsing a c file or inside the pragma dump */
    this.cMode = false;
    /** @type {Info?} has value inside class declaration  */
    this.currentClass = undefined;
    /** @type {Info?} has value inside a procedure, function or method  */
    this.currentMethod = undefined;
    /** @type {Array<Object>} removed comments */
    this.removedComments = [];
    this.resetComments();
    /** @type {string} file name on the disk (program.prg)*/
    this.currentDocument = "";
    /** @type {Array<Group>} An array of current groups*/
    this.groupStack = [];
    /** @type {Array<Group>} An array of current groups of preprocessor*/
    this.preprocGroupStack = [];
    // **** OUTPUTS
    /** @type {Array<Info>} */
    this.funcList = [];
    /**
     * @typedef dbInfo
     * @property {string} dbInfo.name the name to show
     * @property {Object.<string, string>} dbInfo.fields every key is the lowercase of the field name that is saved in the value
     */
    /** @type {Object.<string, dbInfo>} every key is the lowercase name of db */
    this.databases = {};
    /** @type {Array<Group>} The array of groups found */
    this.groups = [];
    /** @type {Array<Group>} The array of preproc groups found */
    this.preprocGroups = [];
    /** @type {Array<string>} The array of included file */
    this.includes = [];
    /** Position of multiline comments.
     * An array of array of 2 number with start and end line
     * @type {number[][]} */
    this.multilineComments = [];
    /** TEMP: current first line of comment,
     * @type {number} */
    this.firstLineCommment = -1;
    /** Position of curly braces {} on C Code
     * an array of array 4 number with line-col of open curly brace, and line-col of cloe curly brace
     * @type {Array<Array<number>>}
     * */
    this.cCodeFolder = [];
    /** list of docs defined with $DOC$
     */
    this.harbourDocs = [];
    // command definitions
    this.commands = [];
}

Provider.prototype.resetComments = function () {
    this.removedComments = [];
    this.newComment();
}

Provider.prototype.newComment = function () {
    if (this.removedComments.length > 0) {
        var lc = this.removedComments[this.removedComments.length - 1];
        if (lc.line == -1) return;
    }
    this.removedComments.push({
        "line": -1,
        "pos": 0,
        "value": ""
    });
}

/**
 * @constructor
 * @param {string} name
 * @param {string} kind like "class","procedure","function"
 * @param {string} foundLike can be "definition","declaration" or "reference"
 * @param {Info} parent
 * @param {string} document
 * @param {number} startLine
 * @param {number} startCol
 * @param {number} endLine
 * @param {number} endCol
 * @param {string} [comment]
 */
function Info(name, kind, foundLike, parent, document, startLine, startCol, endLine, endCol, comment) {
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.nameCmp = name.toLowerCase();
    /** @type {string} */
    this.kind = kind;
    /** @type {string} */
    this.foundLike = foundLike;
    /** @type {Info} */
    if(typeof(parent)=="string") {
        this.parentName = parent;
        this.parent = undefined;
    } else
        this.parent = parent;
    /** @type {string} */
    this.document = document;
    /** @type {number} */
    this.startLine = startLine;
    /** @type {number} */
    this.startCol = startCol;
    /** @type {number} */
    this.endLine = endLine;
    /** @type {number} */
    this.endCol = endCol;
    if (comment) {
        // remove the first newline and replace every character repeated more than 3 times that it is not a space, with 2 of them.
        this.comment = comment.trim().replace(/(\S)\1{2,}/g, "$1$1")
    }
}

/**
 * @param {string} name
 * @param {string} kind
 * @param {Info} parent
 * @param {boolean=} search
 */
Provider.prototype.addInfo = function (name, kind, like, parent, search) {
    if (search !== true) search = false;
    if (search) {
        var lines = this.currLine.split("\r\n");
        var rr = new RegExp('\\b' + name.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + '\\b', "i")
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var m = rr.exec(line)
            if (m) {
                var thisComment = "";
                var nextComma = line.indexOf(",", m.index);
                if (nextComma < 0) nextComma = line.indexOf(")", m.index);
                if (nextComma < 0) nextComma = line.length + 10;
                var prevComma = line.lastIndexOf(",", m.index);
                //if(prevComma<0) prevComma=0;
                for (var ic = 0; ic < this.removedComments.length; ic++) {
                    if (this.removedComments[ic].line == this.startLine + i && ( //same line
                        (this.removedComments[ic].pos < nextComma && //inside this elements commas
                            this.removedComments[ic].pos > prevComma) ||
                        (this.removedComments[ic].pos >= line.length &&  // the comment is at end of line
                            line.indexOf(",", nextComma + 1) < 0))) // it is the last elemen in the line
                        thisComment = this.removedComments[ic].value;
                }
                var ii = new Info(name, kind, like, parent, this.currentDocument,
                    this.startLine + i, m.index, this.startLine + i, m.index + name.length, thisComment);
                this.funcList.push(ii);
                return ii;
            }
        }
    }
    var comment = this.lastComment;
    if (this.removedComments.length > 0) for (let i = 0; i < this.removedComments.length; i++) {
        const comm = this.removedComments[i];
        if (comm.line < this.startLine)
            comment = comm.value;
        else
            break;
    }
    var ii = new Info(name, kind, like, parent, this.currentDocument,
        this.startLine, 0, this.lineNr, 1000, comment);
    this.funcList.push(ii);
    return ii;
}

/**
 * @constructor
 * @param {number} line
 * @param {number} startCol
 * @param {number} endCol
 */
function KeywordPos(line, startCol, endCol, text) {
    /** @type {number} */
    this.line = line;
    /** @type {number} */
    this.startCol = startCol;
    /** @type {number} */
    this.endCol = endCol;
    /** @type {string} */
    this.text = text;
}

/**
 * @constructor
 * @param {string} type Possible values are: for, while, procedure
 */
function Group(type) {
    this.type = type;
    /**  @type {KeywordPos[]} */
    this.positions = [];
}


Group.prototype.addRange = function (line, startCol, endCol, text) {
    this.positions.push(new KeywordPos(line, startCol, endCol, text));
}

Provider.prototype.linePP = function (line) {
    var oriLine = line;
    this.lineNr++;
    if (this.comment) {
        var eC = line.indexOf("*/");
        if (eC == -1) {
            this.lastComment += "\r\n" + line;
            return;
        }
        this.lastComment += "\r\n" + line.substr(0, eC)
        line = line.substr(0, eC + 2).replace(/[^\s]/g, " ") + line.substr(eC + 2);
        this.comment = false;
    }
    if(this.pragmaText) {
        this.currLine="";
        if( /^\s*(?:#\s*pragma\s+__)?endtext/i.test(line) ) {
            line ="";
            this.currLinePreProc = oriLine;
            this.pragmaText = false
        } else
            return;
    }
    if (this.cont) {
        if (!this.currLine.endsWith("\r\n")) {
            if (this.currLine.endsWith("\n") || this.currLine.endsWith("\r"))
                this.currLine.substr(0, this.currLine.length - 1);
            this.currLine += "\r\n";
            this.currLinePreProc += "\r\n";
        }
        this.currLine += line;
        this.currLinePreProc += oriLine;
    } else {
        this.startLine = this.lineNr;
        this.currLine = line;
        this.currLinePreProc = oriLine;

        if( /^\s*#\s*pragma\s+(?:__text|__stream|__cstream)\b/i.test(line) ||
            /^\s*(text)\b/i.test(line)) {
            this.currLine = "";
            this.pragmaText = true;
            return;
        }
    }

    this.cont = line.trim().endsWith(";") && !this.cMode;
}

Provider.prototype.linePrepare = function (line) {
    var justStart = true, precJustStart = true;
    var precC = " ", c = " ";
    var string = "", stringStart;
    if (this.currLine.trim().length == 0) {
        if (line.trim().length == 0)
            this.resetComments()
        this.currLine = "";
        this.currLinePreProc = "";
        return;
    }
    if (!this.cMode && this.currLine.trim().match(/^NOTE\s/i)) {
        this.lastComment += "\r\n" + this.currLine.trim().substr(4);
        this.currLine = "";
        this.currLinePreProc = "";
        if (this.firstLineCommment < 0) this.firstLineCommment = this.lineNr;
        return;
    }
    var lineStart = 0;
    var i = this.currLine.length-line.length;
    if(i>0) {
        c = this.currLine[i-1];
        lineStart = i;
        justStart = false;
    }
    for (; i < this.currLine.length; i++) {
        precC = c;
        precJustStart = justStart;
        c = this.currLine[i];
        if (justStart) {
            justStart = (precC == " " || precC == '\t');
        }
        if (c == "\n" || precC == "\r") lineStart = i + 1;
        // already in string
        if (string.length != 0) {
            if (c == string[0]) {
                if (string == '"e' && precC == '\\')
                    continue; // escaped " inside escaped string
                this.currLine = this.currLine.substring(0, stringStart + 1) + ' '.repeat(i - stringStart - 1) + this.currLine.substring(i);
                string = "";
            }
            continue;
        }
        // check code
        if (c == "*") {
            if (precC == "/") {
                var endC = this.currLine.indexOf("*/", i + 1)
                if (endC > 0) {
                    if (!precJustStart) this.newComment()
                    this.lastComment = "\r\n" + this.currLine.substr(i + 1, endC - i - 1)
                    this.lastCommentPos = i - lineStart;
                    this.newComment();
                    this.currLine = this.currLine.substr(0, i - 1) +
                        " ".repeat(endC - i + 3) +
                        this.currLine.substr(endC + 2);
					this.cont = this.currLine.trim().endsWith(";");
                    continue;
                } else {
                    if (!precJustStart)
                        this.newComment();
                    this.lastComment += "\r\n" + this.currLine.substr(i + 1)
                    this.lastCommentPos = i - lineStart;
                    this.comment = true;
                    this.currLine = this.currLine.substr(0, i - 1)
                    if (this.firstLineCommment < 0) this.firstLineCommment = this.lineNr;
                    return;
                }
            }
            if (justStart && !this.cMode) {
                // commented line: skip
                this.lastComment += "\r\n" + this.currLine.substr(i + 1)
                this.currLine = "";
				this.currLinePreProc = "";
                if (this.firstLineCommment < 0) this.firstLineCommment = this.lineNr;
                return;
            }
        }
        if ((c == "/" && precC == "/") || (c == "&" && precC == "&" && !this.cMode)) {
            if (!precJustStart)
                this.newComment();
            this.lastComment += "\r\n" + this.currLine.substr(i + 1)
            this.lastCommentPos = i + 1 - lineStart;
            this.currLine = this.currLine.substr(0, i - 1)
            this.cont = this.currLine.trim().endsWith(";");
            if (precJustStart && this.firstLineCommment < 0)
                this.firstLineCommment = this.lineNr;
            return;
        }
        if (c == '"') {
            string = c;
            stringStart = i;
            if (precC == "e" || this.cMode) {
                string += 'e';
            }
            continue;
        }
        if (c == "'") {
            string = c;
            stringStart = i;
            continue;
        }
        if (c == "[" && /[^a-zA-Z0-9_\[\]]/.test(precC) && !/^\s*#/.test(this.currLine)) {
            string = "]";
            stringStart = i;
        }
        continue;
    }
}

Provider.prototype.parseDeclareList = function (list, kind, parent) {
    //list=list.join(" ");
    //console.log("-1:"+list);
    var i = -1;
    while (true) {
        i++;
        var filter = undefined;
        switch (i) {
            case 0: filter = /\([^\(\)]*\)/g; break;    // () couple
            case 1: filter = /;\s*\r?\n/g; break;    //  New line
            case 2: filter = /'[^']*'/g; break;        // '' string
            case 3: filter = /"[^"]*"/g; break;        // "" string
            case 4: filter = /\[[^\[\]]*\]/g; break;    // [] string or array index
            case 5: filter = /{[^{}]*}/g; break;        // {} array declaration
            case 6: filter = /:=(?:[^,]|$)*/g; break;         // Assegnation
        }
        if (filter == undefined)
            break;
        do {
            var old = list;
            list = list.replace(filter, "")
        } while (old.length != list.length)
        //console.log(i+":"+list);
    }
    //list=list.replace(/\s+/g,"").split(",");
    list = list.split(",");
    //return list.split(",");
    //if(list.length>1) this.lastComment = ""
    for (var i = 0; i < list.length; i++) {
        var m = list[i].trim().split(/\s+/g)[0];
        if (m.length > 0 && m.match(/[a-z0-9_]+/i))
            this.addInfo(m, kind, "definition", parent, true);
    }
}

Provider.prototype.parseCommand = function () {
    if (!commandPartsingEnabled)
        return;
    var pos = this.currLine.match(/\s+/);
    pos = pos.index + pos[0].length;
    var endDefine = this.currLine.indexOf("=>");
    if (endDefine < 0) return; // incomplete code
    var definePart = this.currLine.substring(pos, endDefine).replace(/;\s+/g, "");
    var resultPart = this.currLine.substring(endDefine + 2).replace(/;\s+/g, "");
    var commandResult = [];
    // SplitDefinePart
    pos = 0;
    while (pos < definePart.length) {
        while (pos < definePart.length && [" ", "\t", "\r", "\n"].indexOf(definePart.charAt(pos)) >= 0)
            pos++;
        var nextChar = definePart.charAt(pos);
        var end;
        if (nextChar == "[") {
            end = definePart.indexOf("]", pos);
			if (end < 0) return undefined; // incomplete
            var open = definePart.indexOf("[", pos + 1);
            if (open < end && open > pos) {
                var nPar = 2;
                end = open + 1;
                while (nPar != 0 && end < definePart.length) {
                    switch (definePart.charAt(end)) {
                        case "[": nPar++; break;
                        case "]": nPar--; break;
                    }
                    end++;
                }
                if (end == definePart.length) return; // incomplete
                end--;
            }
            commandResult.push({ text: definePart.substring(pos + 1, end), fixed: false });
            pos = end + 1;
            continue;
        }
        end = definePart.indexOf("[", pos);
        if (end >= 0) {
            commandResult.push({ text: definePart.substring(pos, end), fixed: true });
            pos = end;
            continue;
        } else {
            if (pos < definePart.length)
                commandResult.push({ text: definePart.substring(pos), fixed: true });
            break;
        }
    }
	return commandResult;
}

function CommandPartToRegex(text) {
	var firstVar = /\s*<([^>]+)>\s*/.exec(text);
	// it is only variable, then no regex.
	if (firstVar && firstVar[0] == text)
		return undefined;
	var pattern;
    // https://stackoverflow.com/a/3561711/854279
	// escape all control charecters
	pattern = text.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	//
	pattern = pattern.replace(/\s+/g, "\\s*");
	//
	pattern = pattern.replace(/<[^>]+>/g, ".*");
	return new RegExp(pattern, "i");
}

function CommandPartToSnippet(text, fixed, resultPart) {
	var snippet = text, repeatable = !fixed
	var variableRegEx = /<!?([^!>]+)!?>/
        var idx = 1;
	var match;
	while (match = variableRegEx.exec(snippet)) {
		var currVar = match[1];
            var colonPos = currVar.indexOf(":");
		var snippetPart = "${" + idx;
            if (colonPos < 0) {
			currVar = currVar.trim().replace(/,\s*\.\.\./, "")
			snippetPart += ":" + currVar
            } else {
                var names = currVar.substr(colonPos + 1).split(",");
                for (let i = 0; i < names.length; i++) {
				snippetPart += `|${names[i].trim()}`
                }
                currVar = currVar.substr(0, colonPos).trim();
            }
		if (repeatable) {
			var resMatch;
			currVar = currVar.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                var varRegEx = new RegExp("(\\[[^\\]]*)?<.?\\b" + currVar + "\\b.?>", "ig");
			while (repeatable && (resMatch = varRegEx.exec(resultPart))) {
				repeatable = repeatable && Boolean(resMatch[1]);
                }
            }
		snippetPart += "}"
		snippet = snippet.replace(match[0], snippetPart)
            idx++;
        }
	return { "snippet": snippet, "repeatable": repeatable };
}

Provider.prototype.parseCommand = function (translate) {
	if (!commandPartsingEnabled)
		return;
	// find the define part and the result part
	var pos = this.currLine.match(/^\s*#\w?(?:command|translate)\s+/i);
	if (!pos) return;
	pos = pos.index + pos[0].length;
	var endDefine = this.currLine.indexOf("=>");
	if (endDefine < 0) return; // incomplete code
	var definePart = this.currLine.substring(pos, endDefine).replace(/;\s+/g, "");
	var resultPart = this.currLine.substring(endDefine + 2).replace(/;\s+/g, "");
	// spli the define part
	var commandResult = CommandSplitDefinition(definePart);
	// create a name from first fixed part
	var i = 0;
	while (!commandResult[i].fixed) i++;
	commandResult.name = commandResult[i].text.trim().replace(/<[^>]+>/g, "").replace(/[,]+/g, "").replace(/\s+/g, " ");
	if (commandResult.name.length <= 0) return; //circular command ?
	// convert define parts in snippets
	for (var i = 0; i < commandResult.length; ++i) {
		commandResult[i].text = commandResult[i].text.trim();
		commandResult[i].regEx = CommandPartToRegex(commandResult[i].text);
		commandResult[i].snippet = CommandPartToSnippet(commandResult[i].text, commandResult[i].fixed, resultPart);
		if (!commandResult[i].snippet) return;
		commandResult[i].repeatable = commandResult[i].snippet.repeatable;
		commandResult[i].snippet = commandResult[i].snippet.snippet;
	}
	var i = 0;
	commandResult.regEx = undefined;
	while (!commandResult.regEx) {
		if (!commandResult[i].fixed) {
			i++;
			continue;
		}
		if (!commandResult[i].regEx) {
			i++;
			continue;
		}
		if (i > 0 || translate)
			commandResult.regEx = commandResult[i].regEx
		else
			commandResult.regEx = new RegExp("^\\s*" + commandResult[i].regEx.source, "i")
    }
    commandResult.startLine = this.startLine
    commandResult.endLine = this.lineNr
    this.commands.push(commandResult);
}

Provider.prototype.parseHarbour = function (words) {
    if (this.currLine.indexOf("#pragma") >= 0 && this.currLine.indexOf("BEGINDUMP") >= 0)
    /* && /\^s*#pragma\s+BEGINDUMP\s*$/.test(this.currLine)*/ {
        if (this.currentMethod) {
            this.currentMethod.endLine = this.lastCodeLine;
            this.currentMethod = undefined;
        }
        this.cMode = true;
        return;
    }
    var words1 = "";
    if (words.length > 1) {
        words1 = words[1];
        words[1] = words[1].toLowerCase();
    } else {
        words[1] = "";
    }
    if (words[0][0] == '#') {
        if (words[0] == '#include') {
            //TODO: check if words1 first and last letter are "" or <>
            var words = this.currLinePreProc.replace(/\s+/g, " ").trim().split(" ");
            if (words.length > 1)
                this.includes.push(words[1].substr(1, words[1].length - 2));
        } else if (words[0] == '#define') {
            var r = defineRegEx.exec(this.currLinePreProc);
            if (r) {
                var define = this.addInfo(r[2], 'define', "definition", undefined, true);
                define.body = r[4] ? r[4].trim() : "";
                if (r[3] && r[3].length)
                    this.parseDeclareList(r[3], "param", define);
            }
		} else if (words[0].endsWith('command') || words[0].endsWith('translate')) {
			this.parseCommand(words[0].endsWith('translate'));
        }
    } else
        if (this.currentClass && (words[0] == "endclass" || (words[0] == "end" && words[1] == "class"))) {
            if (this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
            this.currentMethod = undefined;
            this.currentClass.endLine = this.lineNr;
        } else
            if (words[0].length >= 4) {
                if ((words[0] == "class") || (words[0] == "create" && words[1] == "class")) {
                    if (this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
                    this.currentMethod = undefined;
                    if (words[0] == "create")
                        this.currentClass = this.addInfo(words[2], 'class', "definition")
                    else
                        this.currentClass = this.addInfo(words1, 'class', "definition")
                } else
                    if (words[0] == "data" || words[0] == "var") {
                        if (this.currentClass) {
                            words[1] = words1;
                            this.parseDeclareList(words.slice(1).join(" "), 'data', this.currentClass)
                        }
                    } else
                        if (words[0] == "method".substr(0, words[0].length)) {
                            var r = methodRegEx.exec(this.currLine);
                            if (r) {
                                var fLike = "definition"
                                if (this.currentClass) fLike = "declaration";
                                if (r[4] && r[4].length) {
                                    r[4] = r[4].toLowerCase();
                                    fLike = "definition";
                                    if ((this.currentClass && this.currentClass.nameCmp != r[4]) || (!this.currentClass)) {
                                        this.currentClass = this.funcList.find((v) => v.nameCmp == r[4]);
                                    }
                                }
                                if (r[5] && r[5].length) fLike = "definition";
                                if (this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
                                this.currentMethod = this.addInfo(r[2], 'method', fLike, this.currentClass || r[4]);

                                if (r[3] && r[3].length)
                                    this.parseDeclareList(r[3], "param", this.currentMethod);
                            }
                        } else
                            if (words[0] == "procedure".substr(0, words[0].length) ||
                                words[0] == "function".substr(0, words[0].length) ||
                                (
                                    (
                                        words[0] == "static".substr(0, words[0].length) ||
                                        words[0] == "init" ||
                                        words[0] == "exit"
                                    ) &&
                                    words[1].length >= 4 &&
                                    (
                                        words[1] == "procedure".substr(0, words[1].length) ||
                                        words[1] == "function".substr(0, words[1].length)
                                    )
                                )) {
                                var r = procRegEx.exec(this.currLine);
                                if (r) {
                                    var kind = r[1].startsWith('p') || r[1].startsWith('P') ? "procedure" : "function";
                                    if (words[0].startsWith("stat")) kind += "*";
                                    if (this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
                                    this.currentMethod = this.addInfo(r[2], kind, "definition");
                                    if (r[3] && r[3].length)
                                        this.parseDeclareList(r[3], "param", this.currentMethod);

                                }
                            } else
                                if (words[0] == "local".substr(0, words[0].length) ||
                                    words[0] == "public".substr(0, words[0].length) ||
                                    words[0] == "private".substr(0, words[0].length) ||
                                    words[0] == "static".substr(0, words[0].length) ||
                                    words[0] == "memvar".substr(0, words[0].length) ||
                                    words[0] == "field".substr(0, words[0].length)) {
                                    // skip this in light mode
                                    if (this.currentMethod && this.light)
                                        return
                                    if (this.currentMethod || words[0].startsWith("stat") ||
                                        words[0].startsWith("memv") || words[0].startsWith("fiel")) {
                                        var kind = "local";
                                        if (words[0].startsWith("publ")) kind = "public";
                                        if (words[0].startsWith("priv")) kind = "private";
                                        if (words[0].startsWith("stat")) kind = "static";
                                        if (words[0].startsWith("memv")) kind = "memvar";
                                        if (words[0].startsWith("fiel")) kind = "field";
                                        words[1] = words1;
                                        this.parseDeclareList(words.slice(1).join(" "), kind, this.currentMethod);
                                    }
                                } //else
            }
}

Provider.prototype.parseC = function () {
    if (this.currLine.indexOf("pragma") >= 0 && this.currLine.indexOf("ENDDUMP") >= 0) {
        // && /\^s*#pragma\s+ENDDUMP\s*$/.test(this.currLine) {
        this.cMode = false;
        return;
    }
    if (this.currLine.indexOf("HB_FUNC") >= 0) {
        var r = hb_funcRegEx.exec(this.currLine);
        if (r) {
            this.addInfo(r[1], 'C-FUNC', "definition");
        }
    }
    var open = this.currLine.indexOf("{"), close = this.currLine.indexOf("}");
    while (open >= 0 || close >= 0) {
        if (open >= 0 && (open < close || close < 0)) {
            this.cCodeFolder.push([this.lineNr, open]);
            open = this.currLine.indexOf("{", open + 1);
        } else
        /*if(close>=0 && (close<open || open<0)) */ {
            var idx = this.cCodeFolder.length - 1;
            while (idx >= 0 && this.cCodeFolder[idx].length > 2) idx--;
            if (idx >= 0) this.cCodeFolder[idx].push(this.lineNr, close);
            close = this.currLine.indexOf("}", close + 1)
        }
    }
}

Provider.prototype.AddMultilineComment = function (startLine, endLine) {
    this.multilineComments.push([startLine, endLine]);
    /** @type{string|undefined} */
    var mComment;
    for (let i = 0; i < this.removedComments.length; i++) {
        const comm = this.removedComments[i];
        if (comm.line == startLine) {
            mComment = comm.value;
            break;
        }
    }
    if (!mComment) return;
    if (mComment.indexOf("$DOC$") < 0) return;
    var lines = mComment.split("\r\n");
    var docInfo, lastSpecifyLine;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length == 0) continue;
        if (line.startsWith("$")) {
            lastSpecifyLine = line;
            switch (lastSpecifyLine) {
                case "$DOC$":
                    docInfo = {}
                    break;
                case "$END$":
                    if (docInfo) this.harbourDocs.push(docInfo);
                    docInfo = undefined;
                    break;
            }
            continue;
        }
        switch (lastSpecifyLine) {
            case "$TEMPLATE$":
                var currTemplate = line.toLowerCase();
                if (currTemplate == "function" || currTemplate == "procedure") {
                    docInfo = {};
                    docInfo["label"] = undefined;
                    docInfo["documentation"] = undefined;
                    docInfo["arguments"] = [];
                    docInfo["template"] = currTemplate;
                }
                break;
            case "$ONELINER$":
                if (docInfo) {
                    if (docInfo["documentation"])
                        docInfo["documentation"] += " " + line;
                    else
                        docInfo["documentation"] = line;
                }
                break;
            case "$SYNTAX$":
                if (docInfo) {
                    if (docInfo["label"])
                        docInfo["label"] += " " + line;
                    else {
                        var p = line.indexOf("(");
                        if (p < 0) break;
                        var name = line.substring(0, p)
                        if (name.indexOf(" ") > 0) {
                            docInfo = undefined;
                            break;
                        }
                        docInfo["name"] = name;
                        docInfo["label"] = line;
                    }
                }
                break;
            case "$ARGUMENTS$":
                if (docInfo) {
                    var ck = /<[^>]+>/;
                    var mm = line.match(ck);
                    if (!docInfo["arguments"]) docInfo["arguments"] = [];
                    if (mm) {
                        var arg = {};
                        arg["label"] = mm[0];
                        arg["documentation"] = line;
                        docInfo.arguments.push(arg);
                    } else if (docInfo.arguments.length > 0)
                        docInfo.arguments[docInfo.arguments.length - 1].documentation += " " + line;
                }
                break;
            case "$RETURNS$":
                if (docInfo) {
                    var ck = /<[^>]+>/;
                    var mm = line.match(ck);
                    if (mm) {
                        var arg = {};
                        arg["name"] = mm[0];
                        arg["help"] = line.replace(mm[0], "").trim();
                        docInfo.return = arg;
                    } else
                        if (docInfo.return)
                            docInfo.return.help += " " + line;
                }
                break;
        }
    }
}

/**
 * @param {string} line
 */
Provider.prototype.parse = function (line) {
    this.linePP(line);
    if (this.comment || this.pragmaText) return;
    this.linePrepare(line);
    if (this.currLine.trim().length == 0 || this.cont) return;
    /** @type{string[]} */
    if (this.firstLineCommment >= 0) {
        if (this.firstLineCommment < this.startLine - 1)
            this.AddMultilineComment(this.firstLineCommment, this.startLine - 1);
        this.firstLineCommment = -1;
    }
    if (this.cMode) {
        //console.debug(this.lineNr+"-"+this.currLine);
        this.parseC();
        if (this.doGroups) this.updateGroups(!this.cMode);
    } else {
        var lines = [this.currLine];
        if (! /^\s*#/.test(this.currLine)) // if does not start with #, see #44
            this.currLine.split(/;(?!\s+[\r\n])/)
        var pre = ""
        var code = false;
        for (var i = 0; i < lines.length; i++) {
            this.currLine = pre + lines[i];
            //console.debug(this.lineNr+"-"+this.currLine);
            var words = this.currLine.replace(/\s+/g, " ").trim().split(" ");
            if (words.length == 0) continue;
            code = true;
            words[0] = words[0].toLowerCase();
            this.findDBReferences();
            this.parseHarbour(words);
            if (this.doGroups) this.updateGroups(true);
            pre += " ".repeat(lines[i].length+1); //add the ; see #44
        }
    }
    if (code)
        this.lastCodeLine = this.lineNr;
    this.resetComments();
}

/**
 * Parse a string
 * @param {string} txt the string to parse
 * @param {string} docName the uri of the file of the incoming text
 * @param {[boolean=false]}  cMode if true it is considered a c file (not harbour)
 */
Provider.prototype.parseString = function (txt, docName, cMode) {
    this.Clear();
    this.currentDocument = docName;
    if (cMode != undefined)
        this.cMode = cMode;
    var lines = txt.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        this.parse(lines[i])
    }
    this.endParse();
}

Provider.prototype.endParse = function () {
    if (this.currentMethod) this.currentMethod.endLine = this.lastCodeLine;
    this.currentMethod = undefined;
    if (this.firstLineCommment > 0 && this.firstLineCommment < this.lineNr - 1)
        this.AddMultilineComment(this.firstLineCommment, this.lineNr - 1);
    for (let i = 0; i < this.harbourDocs.length; i++) {
        var doc = this.harbourDocs[i];
        if (!doc.name) continue;
        var lCmp = doc.name.toLowerCase()
        for (let j = 0; j < this.funcList.length; j++) {
            const info = this.funcList[j];
            if (info.nameCmp == lCmp) {
                info.hDocIdx = i;
                break;
            }
        }
    }
}

/**
 * Parse a file from disc. Async
 * @param {string} file the file to parse, inside the filesystem
 * @param {string} docName the uri of the file to parse
 * @param {[boolean=false]} cMode if true it is considered a c file (not harbour)
 * @param {string} encoding the encoding to use
 * @returns {Promise<Provider>} this
 */
Provider.prototype.parseFile = function (file, docName, cMode, encoding) {
    var providerThisContext = this;
    this.Clear();
    if (cMode != undefined)
        this.cMode = cMode;
    encoding = encoding || "utf8";
    this.currentDocument = docName;
    return new Promise((resolve, reject) => {
        var reader = readline.createInterface({ input: fs.createReadStream(file, encoding) });
        reader.on("line", d => providerThisContext.parse(d));
        reader.on("close", () => {
            providerThisContext.endParse();
            resolve(providerThisContext);
        })
    });
}

Provider.prototype.findDBReferences = function () {
    var dbRegex = /([a-z0-9_]+|\([^\(\)]+\))->([a-z0-9_]+)/gi
    var dbRef;
    while (dbRef = dbRegex.exec(this.currLine)) {
        var dbName = dbRef[1].toLowerCase().replace(" ", "").replace("\t", "");
        var fieldName = dbRef[2].toLowerCase();
        if (dbName == 'field') {
            this.addInfo(dbRef[2], "field", "reference", undefined, true);
        } else {
            if (!(dbName in this.databases))
                this.databases[dbName] = { name: dbRef[1], fields: {} };
            if (!(fieldName in this.databases[dbName].fields)) {
                this.databases[dbName].fields[fieldName] = dbRef[2];
            }
        }
    }
}

// every group is an array (TODO class?)
// 0 is name, 1 is start keyword, (2...n-2) middle keyword, (n-1) last keyword
var group_keywords = [
    ["if", "if", /else(?:if)?\b/, /end(?:\b|\s*if\b)/],
    ["for", /for(?:\s+each)?\b/, "loop", "exit", "next"],
    ["case", /(switch|do\s+case)\b/, "case", "otherwise", "default", "exit", /end\s*(?:switch|case)?\b/],
    ["while", /(?:do\s*)?while\b/, "loop", "exit", /end(?:\b|\s*do\b)/],
    ["try", "try", "catch", /end(?:\s*do)?\b/],
    ["sequence", /begin\s+sequence\b/, "recover", /end(?:\s*sequence)?\b/],
    ["dump", /#pragma\s+begindump\b/, /#pragma\s+enddump/],
];
//it can be mixed with other groups
var preproc_keywords = [
    ["#if", /#if(?:n?def)?\b/, /#else(?:if)?\b/, /#end\s*(?:if)?\b/]
];
function removeStrings(keywords) {
    for(let i=0;i<keywords.length;++i)
    for(let j=1;j<keywords[i].length;++j)
        if(typeof(keywords[i][j])=="string") {
            keywords[i][j] = new RegExp(keywords[i][j]+"\\b");
        }
}
removeStrings(group_keywords);
//removeStrings(preproc_keywords);

/**
 *
 * @param {Array<Group>} dest destination array of found groups
 * @param {Array<Group>} destStack destination array of pending groups
 * @param {Array<Array<string|RegExp>>} keywords  array of groups keywords
 * @param {String} checkString string to check, already trimmed at start  and converted to lowercase
 * @param {numer} pos number of trimmed character at start
 * @param {number} lineNr current line number
 */
function GroupManagement(dest, destStack, keywords, checkString, pos, lineNr) {
    /** @type {Array<RegExp>} temp variable to store the list of keywords */
    var currKeywords;
    /** @type {Group} temp variable to store a group */
    var currGroup;
    // looking for new group start
    for (var i = 0; i < keywords.length; i++) {
        var m; // if match the first keyword, a new group begins
        if ((m = checkString.match(keywords[i][1])) && m.index == 0) {
            currGroup = new Group(keywords[i][0]);
            // put it on pending
            destStack.push(currGroup);
            currGroup.addRange(lineNr, pos, pos + m[0].length, m);
            return
        }
    }
    // looking for pending group, starting from the last opened
    for (var j = destStack.length - 1; j >= 0; j--) {
        currGroup = destStack[j];
        // find the current examined group keyword list
        currKeywords = keywords.find(v => v[0] == currGroup.type);
        for (var i = 2; i < currKeywords.length; i++) {
            var m;  // try all keywords on group
            if ((m = checkString.match(currKeywords[i])) && m.index == 0) {
                currGroup.addRange(lineNr, pos, pos + m[0].length, m);
                if (i == currKeywords.length - 1) {
                    // the last keyword close the group
                    // pop from pending push on found
                    dest.push(destStack.pop());
                }
                return
            }
        }
    }
}

Provider.prototype.updateGroups = function (harbour) {
    var checkString = this.currLine.toLowerCase();
    var pos = checkString.length - checkString.trimLeft().length;
    checkString = checkString.substr(pos);
    var ln = this.startLine;
    if (harbour) GroupManagement(this.groups, this.groupStack, group_keywords, checkString, pos, ln);
    GroupManagement(this.preprocGroups, this.preprocGroupStack, preproc_keywords, checkString, pos, ln);
}

exports.Info = Info;
exports.Provider = Provider;
