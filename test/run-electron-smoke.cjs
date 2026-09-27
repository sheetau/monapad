const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-"));
const settingsProfile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-settings-"));
const electron = require("electron");
const phases = process.argv.slice(2);
for (const phase of phases.length ? phases : ["initial", "restore", "transfer", "settings-none", "settings-one", "settings-reset", "settings-failure", "settings-restart", "update-now", "update-later", "update-cancel", "update-start"]) {
  const phaseProfile = phase.startsWith("settings-") ? settingsProfile : (phase.startsWith("update-") || phase === "transfer") ? fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-")) : profile;
  const result = spawnSync(electron, [path.join(__dirname, "electron-smoke.cjs")], {
    stdio: "inherit", windowsHide: true, timeout: 90000,
    env: { ...process.env, MONAPAD_SMOKE_PROFILE: phaseProfile, MONAPAD_SMOKE_PHASE: phase },
  });
  if (result.status !== 0 || !fs.existsSync(path.join(phaseProfile, `${phase}.passed`))) {
    console.error(result.error || `Electron phase ${phase} failed (${result.status}); profile: ${phaseProfile}`);
    process.exit(1);
  }
}
console.log(`All Electron smoke checks passed. Test profile: ${profile}`);
