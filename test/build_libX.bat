goto start
:setup
set HB_INSTALL_PREFIX=C:\xharbour
SET CD_SRC=%CD%
:: I use visual studio 2017 x86 on a win64 system.
CALL "c:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars32.bat"
echo on
cd %CD_SRC%
set path=%PATH%;%HB_INSTALL_PREFIX%\bin;%HB_INSTALL_PREFIX%\bin\win\msvc

:start
harbour dbg_lib.prg -oobj\dbg_lib.c -I%HB_INSTALL_PREFIX%\include -gc0
IF %ERRORLEVEL% GEQ 1000 goto setup 
cl obj\dbg_lib.c -I%HB_INSTALL_PREFIX%\include /c /Foobj/dbg_lib.obj
lib obj/dbg_lib.obj /out:code_dbgX.lib
