:start
hbmk2 %1 %2 %3 %4 %5 %6 %7 %8 %9
IF %ERRORLEVEL% LSS 1000 goto :eof
set HB_INSTALL_PREFIX=C:\harbour
SET CD_SRC=%CD%
CALL "c:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars32.bat"
if %ERRORLEVEL%==1 CALL "c:\Program Files\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars32.bat"
if %ERRORLEVEL%==1 CALL "c:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars32.bat"
echo on
cd %CD_SRC%
set path=%PATH%;%HB_INSTALL_PREFIX%\bin;%HB_INSTALL_PREFIX%\bin\win\msvc
goto start
