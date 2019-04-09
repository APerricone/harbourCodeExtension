@echo off
SET CDPATH=%CD%
CALL "c:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars64.bat"
set path=%PATH%;C:\harbour64\bin\win\msvc64
cd %CDPATH%
hbmk2 dbg_lib -w3 -ql -o64/code_dbg -debug -hblib
pause
