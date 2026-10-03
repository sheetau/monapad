// Build an isolated fixture with the real Monaco and the production adapter.
// node test/run-viewport-wrapping.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const webpack = require("webpack");
const config = require("../webpack.config.js");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-wrapping-"));
webpack({ ...config, mode: "development", devtool: false,
  entry: path.join(__dirname, "viewport-wrapping-fixture.js"),
  output: { ...config.output, path: output },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString()); process.exitCode = 1; return; }
  fs.writeFileSync(path.join(output, "index.html"), '<!doctype html><meta charset="utf-8"><script defer src="bundle.js"></script>', "utf8");
  const result = spawnSync(require("electron"), [path.join(__dirname, "viewport-wrapping-electron.cjs"), output], {
    stdio: "inherit", windowsHide: true, timeout: 120000,
  });
  process.exitCode = result.status ?? 1;
  if (result.error) console.error(result.error);
});
