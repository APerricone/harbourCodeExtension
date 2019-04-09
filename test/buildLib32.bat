@echo off
SET CDPATH=%CD%
CALL "c:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars32.bat"
set path=%PATH%;C:\harbour32\bin\win\msvc
cd %CDPATH%
hbmk2 dbg_lib -w3 -ql -o32/code_dbg -debug -hblib
pause

