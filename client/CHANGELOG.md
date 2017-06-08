# Change Log
All notable changes to the "harbour" extension will be documented in this file.

## Planned
- Show matches on 'if-else-endif', 'for-exit-loop-next' etc...

## unreleased
- better validation message when the error contains a regEx character

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