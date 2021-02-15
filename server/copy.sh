npx webpack --mode production
mkdir -p ../client/server/dist
cp -Rvf dist/ ../client/server
cp -vf package.json ../client/server
mkdir -p ../client/extra
cp -vf ../test/dbg_lib.prg ../client/extra
cd ../client
npx webpack --mode production
