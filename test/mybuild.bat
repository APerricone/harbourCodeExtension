set HB_INSTALL_PREFIX=C:\harbour
:: I use visual studio 2013 in a win64 system.
call "C:\Program Files (x86)\Microsoft Visual Studio 12.0\Common7\Tools\VsDevCmd.bat"
set path=%PATH%;%HB_INSTALL_PREFIX%\bin
hbmk2 %1 %2 %3 %4 %5 %6 %7 %8 %9