# Change Log
All notable changes to the "Harbour and xHarbour" extension will be documented in this file.

# 1.0.0
 - **server** fixed crash [#70](https://github.com/APerricone/harbourCodeExtension/issues/70)

# 0.9.16
 - **server** fixed crash on space before -> [#69](https://github.com/APerricone/harbourCodeExtension/issues/69)

# 0.9.15
 - **server** fixed freeze looking for references last word of the file
 - **server** even better performance on long splitted line [#68](https://github.com/APerricone/harbourCodeExtension/issues/68) (the sample file come from 1.7sec to 0.17 on my PC)

# 0.9.14
 - **server** better performance on long splitted line [#68](https://github.com/APerricone/harbourCodeExtension/issues/68)
 - **server** first support for [semantic token](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)
 - **server** first support for "[find all references](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#find-all-references-to-a-symbol)"
 - **validation** hightlight of unused symbol
 - **syntax** added shared keyword [#64](https://github.com/APerricone/harbourCodeExtension/issues/64)

# 0.9.13
 - **debugger** better stability

# 0.9.12
 - **debugger** better stability
 - **task** better stability
 - **task** correct management of batch option

# 0.9.11
 - **server** fixes case of unfound parent [#57](https://github.com/APerricone/harbourCodeExtension/issues/57)
 - **syntax** fixes [memvar aliasing syntax highlighting #58](https://github.com/APerricone/harbourCodeExtension/issues/58),
    [Multiline "inline" class methods syntax highlighting #59](https://github.com/APerricone/harbourCodeExtension/issues/59),
    [Try catch syntax highlighting #60](https://github.com/APerricone/harbourCodeExtension/issues/60) by [Edgard Lorraine Messias](https://github.com/edgardmessias)
 - **debugger** better step out and step next support
 - **server** better code folding see [#56](https://github.com/APerricone/harbourCodeExtension/issues/56)
 - **task** added temporary variable solver waiting for [VSCode #81007](https://github.com/microsoft/vscode/issues/81007)

 Many thanks to [Seth Hovestol](https://github.com/Hovestar) for bug reporting

# 0.9.10
 - **debugger** added process list on attach, attach by process Id
 - **task** added Harbour and HBMK2 tasks, BETA
 - **server** added completition and go to definition on #pragma include [#45](https://github.com/APerricone/harbourCodeExtension/issues/45)
 - **syntax** better operator and keyworld list
 - **debugger** better filename uppercase/lowercase check using external library
 - **general** updated used libraries

# 0.9.9
 - **server** fixed error message "cannot read property" [#43](https://github.com/APerricone/harbourCodeExtension/issues/43)
 - **server** restored define "go to definition"
 - **validation** trying to solve problem of wrong file name

# 0.9.8
 - fix crash

# 0.9.7
 - missing files

# 0.9.6
 - **server** [better outline and breadcump](https://github.com/APerricone/harbourCodeExtension/raw/master/images/0_9_6.png)
 - **debugger** fixed compilation with xHarbour, see #38
 - **server** better group nearest support
 - **syntax** fixed classdata syntax highlight
 - **server** better define support
 - **server** better "case" folding
 - **decorator** use of editorBracketMatch colors

# 0.9.5
 - **debugger** resolved breakpoint invalid on far source, fix ([#35](https://github.com/APerricone/harbourCodeExtension/issues/35))
 - **debugger** resolved file not found on relative path, fix ([#36](https://github.com/APerricone/harbourCodeExtension/issues/36))

# 0.9.4
 - **server** added Folder provider
 - **decorator** use of server
 - **server** better performance, stability + some fixes ([#32](https://github.com/APerricone/harbourCodeExtension/issues/32))
 - **syntax** minor fixes
 - **server** Added harbourDoc support
 - **client** Added auto harbourDoc generation on **/&ast; $DOC$**

# 0.9.3
 - **server** fixed wordBasedSuggestions for methods and fields
 - **debugger** added ATTACH support
 - **debugger** better stack format
 - **debugger** better management of eval error

# 0.9.2
 - **server** speed-up completition
 - **server** use of editor.wordBasedSuggestions setting
 - **syntax** Fixed multiline string on screen (aka TEXT/ENDTEXT)

# 0.9.1
 - **server** Fix error pressing CTRL on empty space [#28](https://github.com/APerricone/harbourCodeExtension/issues/28)
 - **syntax** Fixed multiline string on screen (aka TEXT/ENDTEXT)

# 0.9.0
 - **server** add hover for defines
 - **syntax** a lot of fixes by [Edgard Lorraine Messias](https://github.com/edgardmessias)
 - **server** added information about class during completition

# 0.8.12
 - **debugger** Added options for error management
 - **server** Fix some crash
 - **syntax** use of [Edgard Lorraine Messias](https://github.com/edgardmessias) syntax
 - **server** Fixed deletion of wrong fields

# 0.8.10 - 0.8.11
  - restored files

# 0.8.9
 - **server** Fix some crash

# 0.8.8
 - **server** New incude file management
 - **server** Added word based suggestions [#16](https://github.com/APerricone/harbourCodeExtension/issues/16)
 - **server** Added keyword suggestions
 - **debugger** Added support for multiline string
 - **debugger** Added terminalType option
 - **debugger** Added handshake
 - **server** Added define on complettion and definition
 - **server** Added public and data in go to workspace symbol
 - **debugger** fix statics in some conditions

# 0.8.7
 - **server** Added check if C file is a compiled prg [#12](https://github.com/APerricone/harbourCodeExtension/issues/12)
 - **server** Removed unused code to avoid performance issues
 - **validation** correct working dir

# 0.8.6
 - **server** added workspaceDepth to fix [#11](https://github.com/APerricone/harbourCodeExtension/issues/11)
 - **server** changed behaviour of search inside symbols, to match VSCode behaviour.
 - **server** fix name of member all lowercase
 - **server** better field management on completition
 - **server** better word match
 - **server** better database management
 - **validation** Better support for relative include path

## 0.8.5
  - **decorator**  restored correct behaviour
  - **server** use of DocumentSymbol
  - **server** removed current word from completition
  - **debugger** fixed crash on expression with colon

## 0.8.4
  - **Server** fixed crash on completition

## 0.8.3
 - **Server** added completition and goto definition on include
 - **Server** fixed crash on completition on beginning of file
 - **Server** removed duplicated completitionItem
 - **Server** fixed static management on completition
 - **Server** fixed link show on onDefinition for files

## 0.8.2
 - **Code** added some snippets
 - **Icon** changed icon
 - **Server** fix crash in case of file outside a workspace

## 0.8.1
 - **server** Added missing file

## 0.8.0
 - **syntax hightlight**: [management of command/translate directive](https://github.com/APerricone/harbourCodeExtension/raw/master/images/command.png)
 - **syntax hightlight**: added abbreviations for local, public, private, etc
 - **server** Added field management
 - **server** Added completition support
 - **server** on workspace symbol you can search a object method adding colon.

## 0.7.9
 - **Server**: [Added multi workspace support](https://github.com/APerricone/harbourCodeExtension/issues/9)
 - **Debugger**: Added completition support (beta)
 - **Server**: better support on no-workspace environment.
 - **Server**: Fixed gotoDefinition for long names
 - **Debugger**: fixed management of access/assign class data.

## 0.7.8
 - **Server**: show comment before function declaration as help
 - **Debugger**: [Added support for copy expression, copy value and add to watch](https://github.com/APerricone/harbourCodeExtension/wiki/Debugger#copy-expression).
 - **Debugger**: Changed view of date and time value on xHarbour to use a valid xHarbour format.

## 0.7.7
 - **Debugger**: Added beta xHarbour support
 - **Debugger**: Fixed case when the module name contains colon
 - **Debugger**: Fixed Log message without carriage return
 - **syntax hightlight**: simplified datetime regex
 - **syntax hightlight**: better 'for' support
 - **syntax hightlight**: added keywords

## 0.7.6
 - **syntax hightlight**: fix for datetime constant
 - **syntax hightlight**: allow min #pragma and macro for inline multiline string
 - **validation**: added validation of opened file
 - **syntax hightlight**: added __streaminclude syntax and fix __stream syntax
 - **decorator**: removed harbour decorator in not-harbour files.

## 0.7.5
 - Added **localization**: English, Italian and Spanish (thanks to José Luis Sánchez for review)

## 0.7.4
 - **Debugger**: added sourcePaths in debugger, to allow to specify more than one directory with code.

## 0.7.3
 - **Fix**: Get debugger code on linux and mac

## 0.7.2
 - **Syntax**: fixed text/endtext

## 0.7.1
 - **Debugger**: Better support for conditional breakpoint and hit count breakoint
 - **Syntax**: Added TEXT/ENDTEXT

## 0.7.0
 - **Debugger**: [beta] added interception of error
 - **Debugger**: Better support for statics.

## 0.6.9
 - **Debugger**: fixed crash adding/removing breakpoints when the program running
 - **Debugger**: fixed freeze starting debug program without debugger
 - **Validator**: fixed "invalid filename" error in validation

## 0.6.8
 - **Added command**: "Harbour: Get debugger code"
 - **Debugger**: fixed startOnEntry = false
 - **Debugger**: Added support for conditional breakpoint, hit count breakoint and LogPoint


## 0.6.7
 - added setting to disable the decorator
 - better decorator code

## 0.6.6
 - enabled **decorator** (marks correspondent if, else, endif, for, next ect ect), BETA.
 - **Fix**ed stall on signature request

## 0.6.5
 - **Server**: parse c file searching harbour function
 - **Fix**: crash on signature for static proc/func

## 0.6.4
 - **Fix**: arguments counting when lone bracket are presents inside string

## 0.6.3
 - **Fix**ed debugger

## 0.6.2
 - **Fix**ed server

## 0.6.1
 -  **Fix**ed arguments counting when commas are presents inside string or inside curly or squared brackets
 - Added message when unable to start the executable on **debug**ging

## 0.6.0
 - Added signature for 342 standard procedure
 - Manage of special case of New
 - Fixed debugger.js on new node/code versions
 - Better validator support for executables

## 0.5.11
- Fixed debugger expression managing
- Added problem matcher for harbour

## 0.5.10
- Fixed crash on server in particular case

## 0.5.9
- Fixed signature help on method and on multiline declaration
- Added looking on sub folder for workspace symbol

## 0.5.8
- Added support for Signature help

## 0.5.7
- Fixed public and private hash and array watch (Thanks to Lailton Fernando Mariano for found the bug)
- Added support for non string hash keys
- removed "Globals" and "Externals" scope until they are not supported.

**need recompile the library from test\dbg_lib.prg**

## 0.5.6
- minor fixes on syntax

## 0.5.5
- added support for multiline text using #pragma

## 0.5.4
- added debugger initial configuration to allow creation of launch.json with harbour
- minor fixes on tmlanguage.

## 0.5.3
- **validation**: added harbour.extraOptions to send extra options to harbour compiler.

## 0.5.2
- **debugger**: better support for object expression, need recompile the library from test\dbg_lib.prg

## 0.5.1
- minimal optimization on debugger

## 0.5.0
- restored version counter

## 0.4.7
- fixed debugger

## 0.4.6
- removed decorator (i don't like if)
- fixed square brace preceded by an upper case character (it is not string)

## 0.4.5
- added data and parameter kind of symbols provider
- added "do case" in decorator

## 0.4.4
- Show matches on 'if-else-endif', 'for-exit-loop-next' (in test)
- Added "go to definition" that works only on current workspace.

## 0.4.3
 - fixed some windows issues

## 0.4.1
 - send symbol kind in the correct way to have icons

## 0.4.0
 - added Language server
 - Added workspace symbol provider

## 0.3.5
- fixed crashes in debugger (need recompile the library too)

## 0.3.4
- fixed double callstack with new VSCode

## 0.3.3
- Fixed expression evaluation
- better validation message when the error contains a regEx character

## 0.3.2
- removed refused debug prints

## 0.3.1
- Added missing method on debugger... still not working
- better validation message when the correct line is inside the message
- recognization of method procedure and method function

## 0.3.0
- New Debug library, it is totally rewritten without C code, it allows new features like:
	- pause support
	- add/remove breakpoint during running
	- step out
	- error catch
	- other bugfixes
- validation only on problem if it is only a word

## 0.2.3
- fix validation when diagnostic is in another file.
- fix typo on debugger

## 0.2.1
- minor fixes

## 0.2.0
- first version of symbol provider.

## 0.1.5
- Removed server code and use of harbour executable to provide diagnostic informations.

## 0.1.0
- semi complete debugging support (see [README](README.md#DEBUG) to know how integrate.)

## 0.0.9
- first version of debugger

## 0.0.3
- better syntax support

## 0.0.2
- custom icon creation

## 0.0.1
- Initial release
- first version of harbour syntax
