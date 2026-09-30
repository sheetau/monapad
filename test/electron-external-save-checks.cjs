const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, evaluate, until, type, menu, delay, setFileSaveHook, setFileReadHook }) => {
  const q = expression => evaluate(win, expression);
  let file;
  const warning = () => q('document.querySelector(".tab.active").classList.contains("has-reload-button") || document.querySelector("#status-left").classList.contains("has-external-warning")');
  async function action(name) {
    await menu(win);
    await q(`document.querySelector('[data-action="${name}"]').click()`);
  }
  async function save() {
    win.webContents.focus();
    await q(`(() => { const root = document.querySelector('#file-diff-view')?.hidden === false ? '#file-diff-view .modified' : '#editor';
      document.querySelector(root + ' .native-edit-context, ' + root + ' textarea.inputarea').focus(); })()`);
    for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({type, keyCode:"S", modifiers:["control"]});
    await until(() => fs.readFileSync(file, "utf8").includes("LOCAL"), "saved to disk");
    await until(async () => !await warning(), "saved external warning cleared");
    await delay(1700);
    assert.equal(await warning(), false, "warning remains cleared after watcher events");
    assert.equal(await q('document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), false);
  }
  for (const diff of [false, true]) {
    file = path.join(profile, diff ? "external-save-diff.txt" : "external-save.txt");
    fs.writeFileSync(file, "alpha\nbeta\ngamma", "utf8");
    win.webContents.send("open-file", file);
    await until(() => q(`document.querySelector(".tab.active .tab-name-label").textContent === ${JSON.stringify(path.basename(file))}`), "file open");
    await type(win, "LOCAL ");
    fs.writeFileSync(file, "alpha\nDISK beta\ngamma", "utf8");
    await until(warning, "external warning");
    if (diff) await action("diffView");
    await save();
    await menu(win);
    assert.equal(await q('document.querySelector("[data-action=mergeChanges]").disabled'), true);
    assert.equal(await q('document.querySelector("[data-action=reloadDisk]").disabled'), true);
    await q('document.querySelector("#tab-context-menu").style.display="none"');
    if (diff) await action("diffView");
  }
  console.log("PASS saving external changes clears warning, diff and merge eligibility in normal/diff views");
  await type(win, "SECOND ");
  fs.writeFileSync(file, "new external content", "utf8");
  await until(warning, "second external warning");
  let savedText;
  setFileSaveHook(async (invoke, args) => {
    savedText = args[2];
    const result = await invoke();
    await delay(350); // A self-save watcher notification can arrive before the reply.
    await type(win, "LATE ");
    return result;
  });
  await q('document.querySelector("#saveFileBtn").click()');
  await until(() => savedText && fs.readFileSync(file, "utf8") === savedText, "save with delayed reply wrote snapshot");
  await delay(800);
  assert.equal(await q('document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), true, "edits made during save stay unsaved");
  assert.equal(await warning(), false, "saved baseline acknowledged despite newer local edits");
  const state = await until(async () => {
    const tab = (await q('window.electronAPI.getSessionWindowState()')).snapshot.tabs.find(t => t.path === file);
    return tab.dirty && tab.content.includes("LATE") ? tab : false;
  }, "new edits persisted in session");
  assert.equal(state.originalContent, savedText);
  await until(async () => {
    const backup = await q(`window.electronAPI.getFileAutosaveBackup(${JSON.stringify(file)})`);
    return backup.exists && backup.content === state.content && backup.meta.mergeBaseContent === savedText;
  }, "new edits backed up with saved base");
  console.log("PASS edits during a delayed save stay dirty, backed up and based on the written snapshot");

  // Failures keep the current external warning and all unsaved text.
  fs.writeFileSync(file, "another external edit", "utf8");
  await until(warning, "warning before failed save");
  setFileSaveHook(async () => ({ success: false }));
  await q('document.querySelector("#saveFileBtn").click()');
  await delay(300);
  assert.equal(await warning(), true);
  assert.equal(fs.readFileSync(file, "utf8"), "another external edit");
  assert.equal(await q('document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), true);

  // A disk read begun before saving may complete after the successful save.
  let releaseRead, readStarted = false;
  const readGate = new Promise(resolve => { releaseRead = resolve; });
  setFileReadHook(async invoke => {
    const info = await invoke(); readStarted = true;
    await readGate; return info;
  });
  win.webContents.send("file:changed", { filePath: file });
  await until(() => readStarted, "old disk read held");
  await save();
  const saved = fs.readFileSync(file, "utf8");
  releaseRead();
  await delay(300);
  assert.equal(await warning(), false, "old read cannot reapply an external warning");
  assert.equal(await q('document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), false);
  assert.equal(fs.readFileSync(file, "utf8"), saved);

  // Save As on the same path and on a different path shares the same commit.
  const { dialog } = require("electron");
  const originalDialog = dialog.showSaveDialog;
  for (const destination of [file, path.join(profile, "saved-as.txt")]) {
    await type(win, "SAVE-AS ");
    fs.writeFileSync(file, "changed before save as", "utf8");
    await until(warning, "warning before Save As");
    const compare = destination !== file;
    if (compare) await action("diffView");
    dialog.showSaveDialog = async () => ({ canceled: true });
    await q('document.querySelector("#saveAsFileBtn").click()');
    await delay(150);
    assert.equal(await warning(), true, "cancel keeps external state");
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
    await q('document.querySelector("#saveAsFileBtn").click()');
    await until(() => fs.existsSync(destination) && fs.readFileSync(destination, "utf8").includes("SAVE-AS"), "Save As wrote working copy");
    await until(async () => !await warning(), "Save As cleared warning");
    file = destination;
    await delay(300);
    assert.equal(await q('document.querySelector(".tab.active .close").classList.contains("show-unsaved")'), false);
    if (compare) await action("diffView");
  }
  dialog.showSaveDialog = originalDialog;

  // Saving a deleted file recreates it and immediately clears the missing-file state.
  fs.unlinkSync(file);
  await until(() => q('document.querySelector(".tab.active .name").classList.contains("warn")'), "deleted file warning");
  await q('document.querySelector("#saveFileBtn").click()');
  await until(() => fs.existsSync(file), "deleted file recreated");
  await until(() => q('!document.querySelector(".tab.active .name").classList.contains("warn") && !document.querySelector("#status-left").classList.contains("has-external-warning")'), "missing-file state cleared");
  console.log("PASS failure/cancellation, stale reads, Save As to same/new path and deleted-file recreation");

  await type(win, "CLOSE ");
  let saveStarted = false;
  setFileSaveHook(async invoke => { saveStarted = true; await delay(400); return invoke(); });
  const count = await q('document.querySelectorAll(".tab").length');
  await q('document.querySelector("#saveFileBtn").click()');
  await until(() => saveStarted, "save started before close");
  await q('document.querySelector(".tab.active .close").click()');
  await until(() => q(`document.querySelectorAll(".tab").length === ${count - 1}`), "tab close waits for save");
  assert.ok(fs.readFileSync(file, "utf8").includes("CLOSE"));
  assert.equal(await q('document.querySelector("#confirm-save").style.display === "flex"'), false);
  console.log("PASS closing a tab during save waits for the committed state");
};
