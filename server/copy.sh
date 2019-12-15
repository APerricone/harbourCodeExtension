npx webpack --mode production 
cp -Rvf dist/ ../client/server
cp -vf package.json ../client/server
cp -vf ../test/dbg_lib.prg ../client/extra
cd ../client
npx webpack --mode production 
