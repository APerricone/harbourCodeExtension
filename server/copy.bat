call npx webpack --mode production 
mkdir ..\client\server
mkdir ..\client\server\dist
copy dist\*.* ..\client\server\dist /Y
copy package.json ..\client\server /Y
mkdir ..\client\extra\
copy ..\test\dbg_lib.prg ..\client\extra\ /Y
cd ..\client
call npx webpack --mode production 
