// Run with: electron test/electron-smoke.cjs
// Uses a temporary profile and hidden windows; never opens the user's notes or installs updates.
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const profile = process.env.MONAPAD_SMOKE_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(), "monapad-smoke-"));
function pass() {
  fs.writeFileSync(path.join(profile, `${process.env.MONAPAD_SMOKE_PHASE || "initial"}.passed`), "ok", "utf8");
  app.exit(0);
}
fs.mkdirSync(path.join(profile, "app-data"), { recursive: true });
app.setPath("appData", path.join(profile, "app-data"));
app.setPath("userData", profile);
app.setPath("sessionData", profile);
process.argv = [process.execPath, "."];
const failures = [];
let expectedMoveFailure = false;
let moveFailureCount = 0;
let expectedExternalError = null, externalErrorCount = 0;
const updatePhase = process.env.MONAPAD_SMOKE_PHASE?.startsWith("update-");
let fakeUpdater;
let updateStaged = process.env.MONAPAD_SMOKE_PHASE === "update-start";
let updateLaunched = false;
if (updatePhase) {
  const { EventEmitter } = require("node:events");
  const { PendingUpdate } = require("../src/pending-update");
  Object.defineProperty(app, "isPackaged", { get: () => true });
  fakeUpdater = new EventEmitter();
  fakeUpdater.checkForUpdates = async () => null;
  const updaterModule = require.resolve("electron-updater");
  require.cache[updaterModule] = { id: updaterModule, filename: updaterModule, loaded: true, exports: { autoUpdater: fakeUpdater } };
  PendingUpdate.prototype.stage = async () => { updateStaged = true; };
  PendingUpdate.prototype.launch = async () => {
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    if (!updateStaged) return false;
    updateLaunched = true;
    return true;
  };
  if (process.env.MONAPAD_SMOKE_PHASE === "update-start") {
    app.once("will-quit", () => {
      assert.equal(updateLaunched, true);
      assert.equal(BrowserWindow.getAllWindows().length, 0);
      console.log("PASS startup installs a pending update before any editor window is created");
      pass();
    });
  }
}
app.on("browser-window-created", (_event, win) => {
  win.show = () => {};
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on("console-message", (event) => {
    if (event.level === "error") { failures.push(event.message); console.error("Renderer error:", event.message); }
  });
});
dialog.showMessageBox = async (_owner, options) => {
  if (updatePhase && (options || _owner).title === "Update Ready") {
    assert.deepEqual((options || _owner).buttons, ["Install now", "Install on next launch"]);
    return { response: process.env.MONAPAD_SMOKE_PHASE === "update-later" ? 1 : 0 };
  }
  if (expectedMoveFailure && (options || _owner).message.includes("original tab has been kept")) {
    expectedMoveFailure = false;
    moveFailureCount++;
    return { response: 0 };
  }
  if (expectedExternalError && (options || _owner).detail?.includes(expectedExternalError)) {
    expectedExternalError = null; externalErrorCount++; return {response:0};
  }
  failures.push(`Unexpected native dialog: ${(options || _owner).message}`);
  console.error(failures.at(-1), (options || _owner).detail || "");
  return { response: 0 };
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
const evaluate = (win, expression) => win.webContents.executeJavaScript(expression, true).catch(error => {
  throw new Error(`Renderer expression failed: ${expression}`, { cause: error });
});
async function ready(win) {
  await until(() => !win.webContents.isLoading(), "window loaded");
  await until(() => evaluate(win, 'Boolean(document.querySelector(".monaco-editor textarea") && window.electronAPI)'), "editor initialized");
  await delay(1000);
  // Inspect copy results without overwriting the user's system clipboard.
  await evaluate(win, 'Object.defineProperty(navigator.clipboard, "writeText", {configurable:true, value:async text => { globalThis.__copiedPath = text; }})');
  return win;
}
async function type(win, content) {
  win.webContents.focus();
  await evaluate(win, 'document.querySelector(".monaco-editor .native-edit-context, .monaco-editor textarea.inputarea").focus()');
  await win.webContents.insertText(content);
}
async function menu(win) {
  await evaluate(win, 'document.querySelector("#tab-context-menu").style.display = "none"');
  await evaluate(win, 'document.querySelector(".tab.active").dispatchEvent(new MouseEvent("contextmenu", {bubbles:true, clientX:60, clientY:20}))');
  await until(() => evaluate(win, 'document.querySelector("#tab-context-menu").style.display === "flex"'), "tab menu");
}

if (process.env.MONAPAD_SMOKE_PHASE === "settings-failure") {
  require("../src/session-manager").SessionManager.prototype.initialize = async () => { throw new Error("Simulated session storage failure"); };
}
let checkpointHook = null;
let fileSaveHook = null;
let fileReadHook = null;
const registerHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, handler) => registerHandler(channel, channel === "autosave:checkpoint-file" ? async (...args) => {
  if (checkpointHook) { const hook = checkpointHook; checkpointHook = null; await hook(); }
  return handler(...args);
} : channel === "file:save" ? async (...args) => {
  const hook = fileSaveHook; fileSaveHook = null;
  return hook ? hook(() => handler(...args), args) : handler(...args);
} : channel === "file:readWithEncoding" ? async (...args) => {
  const hook = fileReadHook; fileReadHook = null;
  return hook ? hook(() => handler(...args), args) : handler(...args);
} : handler);
require("../src/main.js");
ipcMain.handle = registerHandler;
(async () => {
  await app.whenReady();
  const first = await ready(await until(() => BrowserWindow.getAllWindows()[0], "initial window"));
  if (process.env.MONAPAD_SMOKE_PHASE?.startsWith("settings-")) {
    await require("./electron-settings-checks.cjs")({ first, profile, phase: process.env.MONAPAD_SMOKE_PHASE, evaluate, until });
    assert.deepEqual(failures, []);
    app.once("will-quit", () => pass());
    app.quit();
    return;
  }
  if (["split-resize", "split-resize-restore"].includes(process.env.MONAPAD_SMOKE_PHASE)) {
    await require("./electron-split-resize-checks.cjs")({ first, profile, phase: process.env.MONAPAD_SMOKE_PHASE, evaluate, until, delay, ready });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (["split", "split-restore", "split-edges", "split-audit", "split-followup"].includes(process.env.MONAPAD_SMOKE_PHASE)) {
    await require("./electron-split-checks.cjs")({ first, profile, phase: process.env.MONAPAD_SMOKE_PHASE, evaluate, until, delay, ready,
      expectMoveFailure: () => { expectedMoveFailure = true; }, moveFailures: () => moveFailureCount });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "transfer") {
    await require("./electron-transfer-checks.cjs")({ first, profile, evaluate, until, ready, type, menu, delay,
      expectMoveFailure: () => { expectedMoveFailure = true; }, moveFailures: () => moveFailureCount });
    assert.deepEqual(failures, []);
    pass();
    return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "external-save") {
    await require("./electron-external-save-checks.cjs")({ first, profile, evaluate, until, type, menu, delay,
      setFileSaveHook: hook => { fileSaveHook = hook; }, setFileReadHook: hook => { fileReadHook = hook; } });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "diff-performance") {
    await require("./electron-diff-performance-checks.cjs")({ first, profile, evaluate, until, type, menu, delay });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "diff-commands") {
    await require("./electron-diff-command-checks.cjs")({ first, profile, evaluate, until, type, menu, delay });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "diff-layout") {
    await require("./electron-diff-layout-checks.cjs")({ first, profile, evaluate, until, type, menu, delay });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "merge-edges") {
    await require("./electron-merge-edge-checks.cjs")({ first, profile, evaluate, until, type, menu, delay, ready,
      setCheckpointHook: hook => { checkpointHook = hook; },
      expectExternalError: text => { expectedExternalError = text; }, externalErrors: () => externalErrorCount });
    assert.deepEqual(failures, []); pass(); return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE?.startsWith("merge")) {
    await require("./electron-merge-checks.cjs")({ first, profile, phase: process.env.MONAPAD_SMOKE_PHASE, evaluate, until, type, menu, delay });
    assert.deepEqual(failures, []);
    app.once("will-quit", () => pass());
    app.quit();
    return;
  }
  if (updatePhase) {
    if (process.env.MONAPAD_SMOKE_PHASE === "update-cancel") {
      await evaluate(first, 'window.electronAPI.setSessionRestoreMode("none")');
    }
    await type(first, "keep this draft through update");
    await until(() => evaluate(first, 'document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), "update draft is dirty");
    if (process.env.MONAPAD_SMOKE_PHASE !== "update-cancel") {
      await until(async () => (await evaluate(first, 'window.electronAPI.getSessionWindowState()')).snapshot?.tabs.some(tab => tab.dirty), "update draft snapshot");
    }
    assert.equal(fakeUpdater.autoInstallOnAppQuit, false);
    fakeUpdater.emit("update-downloaded", { version: "99.0.0" });
    await until(() => updateStaged, "update staged");
    if (process.env.MONAPAD_SMOKE_PHASE === "update-cancel") {
      await until(() => evaluate(first, 'document.querySelector("#confirm-save-window").style.display === "flex"'), "update save prompt");
      await evaluate(first, 'document.querySelector("#confirm-cancel-all").click()');
      await delay(200);
      assert.equal(first.isDestroyed(), false);
      assert.equal(updateLaunched, false);
      console.log("PASS cancelling the save prompt cancels immediate installation");
      pass();
    } else if (process.env.MONAPAD_SMOKE_PHASE === "update-later") {
      await delay(200);
      assert.equal(first.isDestroyed(), false);
      assert.equal(updateLaunched, false);
      app.once("will-quit", () => {
        assert.equal(updateLaunched, false);
        console.log("PASS deferred update is staged without installing on normal quit");
        pass();
      });
      app.quit();
    } else {
      let checkingUpdateQuit = false;
      const onUpdateQuit = event => {
        if (!updateLaunched) return;
        event.preventDefault();
        if (checkingUpdateQuit) return;
        checkingUpdateQuit = true;
        (async () => {
          const { SessionManager } = require("../src/session-manager");
          const manager = new SessionManager(path.join(profile, "session"));
          await manager.initialize();
          const state = await manager.hydrateWindow(manager.getState().windows[0].id);
          assert.equal(state.tabs[0].content, "keep this draft through update");
          assert.deepEqual(failures, []);
          console.log("PASS Install now waits for window closure and verified draft persistence");
          pass();
        })().catch(error => { console.error(error); app.exit(1); });
      };
      app.on("will-quit", onUpdateQuit);
    }
    return;
  }
  if (process.env.MONAPAD_SMOKE_PHASE === "restore") {
    await until(() => BrowserWindow.getAllWindows().length === 2, "both windows restored");
    const states = [];
    for (const win of BrowserWindow.getAllWindows()) {
      await ready(win);
      states.push(await evaluate(win, 'window.electronAPI.getSessionWindowState()'));
    }
    assert.equal(states.length, 2);
    assert.ok(states.some(state => state.snapshot.tabs.some(tab => tab.content === "first window draft")));
    assert.ok(states.some(state => state.snapshot.tabs.some(tab => tab.kind === "file" && tab.content.includes("local edit"))));
    assert.ok(states.every(state => !state.snapshot.tabs.some(tab => tab.content === "discard this draft")));
    for (const lang of ["it", "es"]) {
      await evaluate(first, `localStorage.setItem("lang", ${JSON.stringify(lang)})`);
      first.webContents.reload();
      await ready(first);
      assert.equal(await evaluate(first, 'globalThis.__MONAPAD_INITIAL_MONACO_NLS_LANG__'), lang);
      assert.equal(await evaluate(first, 'document.documentElement.lang'), lang === "it" ? "it-IT" : "es-ES");
      await menu(first);
      const expected = (lang === "it" ? "Copia percorso del backup" : "Copiar ruta de la copia de seguridad");
      assert.equal(await evaluate(first, 'document.querySelector("[data-action=copyBackupPath] .label").textContent'), expected);
    }
    assert.deepEqual(failures, []);
    console.log("PASS separate window restoration, no discarded draft resurrection, Italian and Spanish UI/NLS");
    pass();
    return;
  }
  assert.equal((await evaluate(first, 'window.electronAPI.getSessionWindowState()')).mode, "all");
  await menu(first);
  assert.equal(await evaluate(first, 'document.querySelector("[data-action=copyBackupPath]").disabled'), true);
  await evaluate(first, 'document.querySelector("#tab-context-menu").style.display = "none"');
  await type(first, "first window draft");
  await until(async () => (await evaluate(first, 'window.electronAPI.getSessionWindowState()')).snapshot?.tabs.some(tab => tab.dirty), "draft snapshot");
  await menu(first);
  await until(async () => {
    await menu(first);
    return !await evaluate(first, 'document.querySelector("[data-action=copyBackupPath]").disabled');
  }, "draft source becomes available");
  assert.equal(await evaluate(first, 'document.querySelector("[data-action=copyBackupPath] .label").textContent'), "Copy Backup Path");
  assert.deepEqual(await evaluate(first, 'Array.from(document.querySelectorAll("#tab-context-menu button")).map(button => button.dataset.action).filter(action => /Path$/.test(action))'), ["copyPath", "openPath", "copyBackupPath", "openBackupPath"]);
  await evaluate(first, 'document.querySelector("[data-action=copyBackupPath]").click()');
  const draftCopy = await until(() => evaluate(first, 'globalThis.__copiedPath'), "quoted draft backup copy");
  assert.ok(draftCopy.startsWith('"') && draftCopy.endsWith('"'));
  assert.equal(fs.readFileSync(draftCopy.slice(1, -1), "utf8"), "first window draft");
  console.log("PASS default restore mode and draft source menu");

  const note = await evaluate(first, 'window.electronAPI.createNote({content:"source note", title:"source note", folderPath:""})');
  const noteSource = await evaluate(first, `window.electronAPI.getTabSourcePath({noteId:${JSON.stringify(note.id)}})`);
  assert.equal(noteSource, note.path);
  assert.equal(fs.readFileSync(noteSource, "utf8"), "source note");
  assert.equal(await evaluate(first, 'window.electronAPI.getTabSourcePath({draftId:"missing_draft"})'), null);
  first.webContents.send("load-tab-data", { isNote: true, noteId: note.id, notePath: note.path, name: "source note", content: "source note" });
  await until(() => evaluate(first, 'document.querySelector(".tab.active").classList.contains("note")'), "note tab loaded");
  await menu(first);
  assert.equal(await evaluate(first, 'document.querySelector("[data-action=copyBackupPath]").disabled'), true);
  assert.equal(await evaluate(first, 'document.querySelector("[data-action=openBackupPath]").disabled'), true);
  await evaluate(first, 'document.querySelector("[data-action=copyPath]").click()');
  await until(async () => (await evaluate(first, 'globalThis.__copiedPath')) === `"${noteSource}"`, "quoted note source copy");
  console.log("PASS note source and missing source");

  await evaluate(first, 'window.electronAPI.createNewWindow()');
  const second = await ready(await until(() => BrowserWindow.getAllWindows().find(win => win !== first), "second window"));
  await type(second, "discard this draft");
  await until(async () => (await evaluate(second, 'window.electronAPI.getSessionWindowState()')).snapshot?.tabs.some(tab => tab.dirty), "second draft snapshot");
  second.close();
  await until(() => evaluate(second, 'document.querySelector("#confirm-save-window").style.display === "flex"'), "non-last close prompt");
  await evaluate(second, 'document.querySelector("#confirm-cancel-all").click()');
  await delay(200);
  assert.equal(second.isDestroyed(), false);
  second.close();
  await until(() => evaluate(second, 'document.querySelector("#confirm-save-window").style.display === "flex"'), "prompt after cancellation");
  await evaluate(second, 'document.querySelector("#confirm-discard-all").click()');
  await until(() => second.isDestroyed(), "confirmed close");
  const { SessionManager } = require("../src/session-manager");
  const manager = new SessionManager(path.join(profile, "session"));
  await manager.initialize();
  assert.equal(manager.getState().windows.length, 1);
  const draftNames = fs.readdirSync(path.join(profile, "autosave", "drafts")).filter(name => name.endsWith(".txt"));
  assert.equal(draftNames.length, 1);
  console.log("PASS non-last close, cancel, discard, and no orphan draft");

  // Move an actually edited file through the tab context menu, then change it externally.
  const file = path.join(profile, "external.txt");
  fs.writeFileSync(file, "saved file");
  first.webContents.send("open-file", file);
  await until(() => evaluate(first, 'document.querySelector(".tab.active .name").textContent.includes("external.txt")'), "file opened");
  await type(first, "local edit ");
  await until(() => evaluate(first, 'document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), "file dirty");
  await menu(first);
  await evaluate(first, 'document.querySelector("[data-action=copyPath]").click()');
  await until(async () => (await evaluate(first, 'globalThis.__copiedPath')) === `"${file}"`, "quoted file path copy");
  await menu(first);
  await evaluate(first, 'document.querySelector("[data-action=openInNewWindow]").click()');
  const moved = await ready(await until(() => BrowserWindow.getAllWindows().find(win => win !== first), "detached window"));
  await until(() => evaluate(moved, 'document.querySelector(".tab.active .name").textContent.includes("external.txt")'), "file transferred");
  assert.equal(await evaluate(moved, 'document.querySelector(".tab.active").classList.contains("has-reload-button")'), false);
  assert.equal(await evaluate(moved, 'document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), true);
  fs.writeFileSync(file, "external edit");
  await until(() => evaluate(moved, 'document.querySelector(".tab.active").classList.contains("has-reload-button")'), "actual external modification detected");
  const source = await evaluate(moved, `window.electronAPI.getTabSourcePath({filePath:${JSON.stringify(file)}})`);
  assert.ok(source && source !== file);
  await menu(moved);
  assert.equal(await evaluate(moved, 'document.querySelector("[data-action=openBackupPath] .label").textContent'), "Open Backup Path");
  await evaluate(moved, 'document.querySelector("[data-action=copyBackupPath]").click()');
  await until(async () => (await evaluate(moved, 'globalThis.__copiedPath')) === `"${source}"`, "quoted file backup copy");
  console.log("PASS dirty tab transfer, real external edit, and file backup source");

  assert.deepEqual(failures, []);
  console.log(`PASS Electron smoke checks (isolated profile: ${profile})`);
  app.once("will-quit", event => {
    event.preventDefault();
    (async () => {
      await manager.initialize();
      assert.equal(manager.getState().windows.length, 2);
      assert.ok(manager.getState().windows.every(win => win.closedAt));
      console.log("PASS application quit saves both windows before closing");
      pass();
    })().catch(error => { console.error(error); app.exit(1); });
  });
  app.quit();
})().catch(async error => {
  for (const win of BrowserWindow.getAllWindows()) {
    try { fs.writeFileSync(path.join(profile, "failure-"+win.id+".png"),(await win.webContents.capturePage(undefined, {stayHidden:true, stayAwake:true})).toPNG());
      console.error(await evaluate(win,'document.querySelector(".file-merge-status")?.textContent')); } catch {}
  }
  console.error(error);
  console.error(failures);
  console.error(`Profile for diagnosis: ${profile}`);
  app.exit(1);
});
