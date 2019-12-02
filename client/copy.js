const spawn = require("child_process").spawn
const platform = require("os").platform()
const cmd = /^win/.test(platform)
  ? `..\\server\\copy.bat`
  : `../server/copy.sh`

spawn(cmd, [], { stdio: "inherit", cwd:"../server/" }).on("exit", code => process.exit(code))
