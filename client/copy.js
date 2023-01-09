const spawn = require("child_process").spawn
const platform = require("os").platform()
const cmd = /^win/.test(platform)
  ? `..\\server\\copy.bat`
  : `../server/copy.sh`

spawn(cmd, [], { stdio: "inherit", cwd:"../server/" }).on("exit", code => {
  const pjson = require('./package.json');
  //console.log(pjson.version);
  const fs = require('fs');
  let rs = fs.createReadStream('../test/dbg_lib.prg');
  let ws = fs.createWriteStream('./extra/dbg_lib.prg');
  ws.write(`// For Harbour extension version v.${pjson.version}\r\n\r\n`)
  rs.pipe(ws).on("finish",()=>{
    process.exit(code)
  });
});
