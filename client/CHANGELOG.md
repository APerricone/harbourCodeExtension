# Change Log
All notable changes to the "harbour" extension will be documented in this file.

## 0.6.1
 - Better signature argument counting
 - Added message when unable to start the executable on debugging

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
- validation: added harbour.extraOptions to send extra options to harbour compiler.

## 0.5.2
- debugger: better support for object expression, need recompile the library from test\dbg_lib.prg

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
- Added missin method on debugger... still not working
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
