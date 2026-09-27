const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first, profile, phase, evaluate, until }) => {
  const state = () => evaluate(first, 'window.electronAPI.getSessionWindowState()');
  const stored = () => JSON.parse(fs.readFileSync(path.join(profile, "config.json"), "utf8"));
  const select = async mode => {
    const result = await evaluate(first, `window.electronAPI.setSessionRestoreMode(${JSON.stringify(mode)})`);
    assert.equal(result.success, true);
    assert.equal((await state()).mode, mode);
    assert.equal(stored().sessionRestoreMode, mode);
  };
  const reset = async () => {
    await evaluate(first, 'document.querySelector("#settings-menu #settingsLayout .reset").click()');
    await until(async () => (await state()).mode === "all", "reset restores all");
    assert.equal(stored().sessionRestoreMode, "all");
  };
  if (phase === "settings-none") {
    assert.equal((await state()).mode, "all");
    await select("none");
  } else if (phase === "settings-one") {
    assert.equal((await state()).mode, "none");
    await select("one");
  } else if (phase === "settings-reset") {
    assert.equal((await state()).mode, "one");
    await reset();
    await select("none");
    await reset();
  } else if (phase === "settings-failure") {
    assert.equal((await state()).mode, "all");
    assert.equal((await state()).enabled, false);
    assert.equal(stored().sessionRestoreMode, "all");
  } else {
    assert.equal((await state()).mode, "all");
    assert.equal((await state()).enabled, true);
  }
  // The legacy shared location is never written by this app/profile.
  assert.equal(fs.existsSync(path.join(profile, "app-data", "electron-store-nodejs", "Config", "config.json")), false);
  console.log(`PASS ${phase}: persistent preference, reset/default and app-local settings isolation`);
};
