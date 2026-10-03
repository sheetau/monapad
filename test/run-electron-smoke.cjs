const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-"));
const settingsProfile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-settings-"));
const mergeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-merge-"));
const splitProfile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-split-"));
const resizeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-resize-"));
const electron = require("electron");
const phases = process.argv.slice(2);
for (const phase of phases.length ? phases : ["initial", "restore", "split", "split-restore", "split-edges", "split-audit", "split-followup", "split-resize", "split-resize-restore", "merge", "merge-restore", "merge-edges", "diff-layout", "diff-performance", "diff-commands", "external-save", "transfer", "settings-none", "settings-one", "settings-reset", "settings-failure", "settings-restart", "update-now", "update-later", "update-cancel", "update-start"]) {
  const phaseProfile = ["split-resize", "split-resize-restore"].includes(phase) ? resizeProfile : ["split", "split-restore"].includes(phase) ? splitProfile : ["merge", "merge-restore"].includes(phase) ? mergeProfile : phase.startsWith("settings-") ? settingsProfile : (phase.startsWith("update-") || phase === "transfer" || phase === "split-edges" || phase === "split-audit" || phase === "split-followup" || phase === "merge-edges" || phase === "diff-layout" || phase === "diff-performance" || phase === "diff-commands" || phase === "external-save") ? fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-")) : profile;
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
