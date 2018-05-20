# code-harbour README

This is an extension for visual studio code about harbour programming language, it is still W.I.P. :)

## Warning
the version 0.3 has a new debugger library, you must update it!!

## Features

- simple and complete syntax hightlight
- Debug support
- Diagnostic infos
- Symbol Definitions Within a Document provider (access it by pressing <kbd>CTRL</kbd>+<kbd>P</kbd> then <kbd>@</kbd>)
- Symbol Definitions in folder provider (access it by pressing <kbd>CTRL</kbd>+<kbd>P</kbd> then <kbd>#</kbd>)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

Currently only Harbour is supported, sometime is to set `harbour.compilerExecutable` with complete path.

## Extension Settings
This extension contributes the following settings:

* `harbour.validating`: enable/disable the validation every open and save of harbour files.
* `harbour.compilerExecutable`: sometime is necessary to set the path of the harbour executable to make validation works.
* `harbour.extraIncludePaths`: add path where found the includes to avoid "file not found" error.
* `harbour.extraOptions`: other options to pass to harbour compiler.
* `harbour.warningLevel`: sets the warning level for validation.
* `harbour.decorator`: if true enables the <u>beta</u> feature of decoration of correspondents if/endif, for/next, while/endwhile, etc etc

## How to use the debugger<a name="DEBUG"></a>
You can use the command "Harbour: Get debugger code" to get the source of the debbugger, save it to a file naming it as you like, for example dbg_lib-prg. You can include this file in your project or **BETTER** create a library with this file to link in your project.

> NOTE: don't forget to compile harbour file with debug information <kbd>-b</kbd>

## Known Issues

