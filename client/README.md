# Antonino Perricone's extension for visual studio code about Harbour and xHarbour programming languages

## Features

- [simple and complete syntax hightlight](https://github.com/APerricone/harbourCodeExtension/wiki/Syntax-hightlight)
- [Debug support](https://github.com/APerricone/harbourCodeExtension/wiki/Debugger)
- [Diagnostic infos](https://github.com/APerricone/harbourCodeExtension/wiki/Diagnostics-Lint)
- Symbol Definitions Within a Document provider (access it by pressing <kbd>CTRL</kbd>+<kbd>SHIFT</kbd>+<kbd>O</kbd> or <kbd>CTRL</kbd>+<kbd>P</kbd> then <kbd>@</kbd>)
- Symbol Definitions in workspace provider (access it by pressing <kbd>CTRL</kbd>+<kbd>T</kbd> or <kbd>CTRL</kbd>+<kbd>P</kbd> then <kbd>#</kbd>)

## Requirements
See the [wiki](https://github.com/APerricone/harbourCodeExtension/wiki) for more information.

Sometime is necessary to set `harbour.compilerExecutable` with complete path.

## Extension Settings
This extension contributes the following settings:

* `harbour.validating`: enable/disable the validation every open and save of harbour files.
* `harbour.compilerExecutable`: sometime is necessary to set the path of the harbour executable to make validation works.
* `harbour.extraIncludePaths`: add path where found the includes to avoid "file not found" error.
* `harbour.extraOptions`: other options to pass to harbour compiler.
* `harbour.warningLevel`: sets the warning level for validation.
* `harbour.decorator`: if true enables the feature of decoration of correspondents if/endif, for/next, while/endwhile, etc etc

## How to use the debugger<a name="DEBUG"></a>
You can use the command "Harbour: Get debugger code" to get the source of the debbugger, save it to a file naming it as you like, for example dbg_lib-prg. You can include this file in your project or **BETTER** create a library with this file to link in your project.

> NOTE: don't forget to compile harbour file with debug information ***-b***

### **IT IS STRONGLY RECOMMENDED TO UPDATE THE FILES EVERY EXTENSION VERSION**

## Known Issues

