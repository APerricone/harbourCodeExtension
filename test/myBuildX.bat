:start
harbour %1.prg -oobj\%1.c -I%HB_INSTALL_PREFIX%\include -gc2 -b 
IF %ERRORLEVEL% GEQ 1000 goto setup 
cl obj\%1.c -I%HB_INSTALL_PREFIX%\include  /c /Foobj/%1.obj 
link obj/%1.obj /libpath:%HB_INSTALL_PREFIX%\lib /subsystem:console ^
    code_dbgX.lib vm.lib rtl.lib common.lib rdd.lib pcrepos.lib ^
    macro.lib dbfntx.lib dbffpt.lib hbsix.lib lang.lib gtwin.lib    
:: 
goto :eof

:setup
set HB_INSTALL_PREFIX=C:\xharbour
SET CD_SRC=%CD%
:: I use visual studio 2017 x86 on a win64 system.
CALL "c:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Auxiliary\Build\vcvars32.bat"
echo on
cd %CD_SRC%
set path=%PATH%;%HB_INSTALL_PREFIX%\bin;%HB_INSTALL_PREFIX%\bin\win\msvc
goto start
