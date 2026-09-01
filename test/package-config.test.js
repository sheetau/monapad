const assert = require("node:assert/strict");
const test = require("node:test");

const packageJson = require("../package.json");

test("release scripts rebuild the production renderer before packaging", () => {
  for (const scriptName of ["dist", "dist:local"]) {
    const script = packageJson.scripts[scriptName];
    assert.match(script, /npm run build:prod/);
    assert.ok(script.indexOf("npm run build:prod") < script.indexOf("electron-builder"));
  }
});

test("packaged files include every unbundled startup module", () => {
  const packagedFiles = new Set(packageJson.build.files);
  for (const filePath of [
    "src/main.js",
    "src/preload.js",
    "src/recovery-policy.js",
    "src/session-manager.js",
    "src/vscode-theme-loader.js",
  ]) {
    assert.ok(packagedFiles.has(filePath), `${filePath} is missing from build.files`);
  }
});
