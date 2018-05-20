mkdir ..\client\server\src
copy src\*.* ..\client\server\src /Y
copy package.json ..\client\server /Y
mkdir ..\client\server\node_modules
xcopy node_modules\*.* ..\client\server\node_modules  /E /Y
mkdir ..\extra
copy ..\test\dbg_lib.prg ..\client\extra /Y
