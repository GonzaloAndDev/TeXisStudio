$root = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$root\scripts\texis.mjs" run @args
