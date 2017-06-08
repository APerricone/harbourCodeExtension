# code-harbour README

This is an extension for visual studio code about harbour programming language, it is still W.I.P. :)

## Warning
the versione 0.3 has a new debugger library, you must update it!!

## Features

- simple and complete syntax hightlight
- Debug support
- Diagnostic infos
- Symbol Definitions Within a Document provider (access it by pressing <kbd>CTRL</kbd>+<kbd>P</kbd> then <kbd>@</kbd>)
- [TODO] Symbol Definitions in folder provider

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

Currently only Harbour is supported, sometime is to set `harbour.compilerExecutable` with complete path.

## Extension Settings
This extension contributes the following settings:

* `harbour.validating`: enable/disable the validation every open and save of harbour files.
* `harbour.compilerExecutable`: sometime is necessary to set the path of the harbour executable to make validation works.
* `harbour.extraIncludePaths`: add path where found the includes to avoid "file not found" error.
* `harbour.warningLevel`: sets the warning level for validation.

## How to use the debugger<a name="DEBUG"></a>
The code of the debugger is inside the [dbg_lib.prg](../test/dbg_lib.prg) you can include this file in your project or **BETTER** create a library with this file to link in your project.

> NOTE: don't forget to compile harbour file with debug information <kbd>-b</kbd>

## Known Issues

