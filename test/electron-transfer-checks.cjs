const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

module.exports = async function ({ first, profile, evaluate, until, ready, type, menu, delay, expectMoveFailure, moveFailures }) {
  async function key(win, keyCode, modifiers = []) {
    win.webContents.focus();
    win.webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
    await delay(80);
  }
  const state = win => evaluate(win, 'window.electronAPI.getSessionWindowState()');
  async function content(win, value, file) {
    return until(async () => {
      const tabs = (await state(win)).snapshot?.tabs || [];
      return tabs.find(tab => (!file || tab.path === file) && (
        tab.content === value || (tab.kind === "file" && !tab.dirty &&
          fs.readFileSync(tab.path, "utf8").replace(/^\uFEFF/, "") === value)
      ));
    }, `content ${JSON.stringify(value)}`);
  }
  async function detach(win) {
    const before = BrowserWindow.getAllWindows();
    await menu(win);
    await evaluate(win, 'document.querySelector("[data-action=openInNewWindow]").click()');
    return ready(await until(() => BrowserWindow.getAllWindows().find(w => !before.includes(w)), "moved window"));
  }
  // Preserve the source window with another meaningful tab.
  await type(first, "keeper");
  const file = path.join(profile, "history.txt");
  const savedContent = "saved\r\n" + Array.from({length:80}, (_, i) => `line ${i}`).join("\r\n") + "\r\nline two";
  fs.writeFileSync(file, "\ufeff" + savedContent, "utf8");
  first.webContents.send("open-file", file);
  await until(() => evaluate(first, 'document.querySelector(".tab.active .tab-name-label").textContent === "history.txt"'), "file loaded");
  await type(first, "A");
  await key(first, "End", ["control"]);
  await type(first, "B");
  await content(first, `A${savedContent}B`, file);
  await key(first, "z", ["control"]);
  await content(first, `A${savedContent}`, file);
  // Leave a nonempty selection, a scrolled viewport and a redo branch.
  await key(first, "End", ["control"]);
  await key(first, "Home");
  await key(first, "Right", ["shift"]);
  await evaluate(first, 'document.querySelector("[data-action=wordWrap]").click(); document.querySelector("[data-action=toggleMarkdown]").click()');
  await key(first, "=", ["control"]);
  const moved = await detach(first);
  const movedState = await content(moved, `A${savedContent}`, file);
  assert.equal(movedState.hasBom, true);
  assert.equal(movedState.dirty, true);
  assert.equal(movedState.wordWrap, false);
  assert.equal(movedState.isMarkdown, true);
  assert.ok(movedState.fontSize > 16);
  assert.equal(movedState.viewState.cursorState[0].position.lineNumber, 82);
  assert.ok(movedState.viewState.viewState.firstPosition.lineNumber > 1);
  assert.equal(movedState.viewState.cursorState[0].selectionStart.column, 1);
  assert.equal(movedState.viewState.cursorState[0].position.column, 2);
  assert.equal(await evaluate(moved, 'document.querySelector(".tab.active .tab-name-description").textContent'), "");
  await until(async () => !(await state(first)).snapshot.tabs.some(tab => tab.path === file), "source tab removed after acknowledgement");
  await key(moved, "z", ["control"]);
  const clean = await content(moved, savedContent, file);
  assert.equal(clean.dirty, false);
  await key(moved, "y", ["control"]);
  await content(moved, `A${savedContent}`, file);
  await key(moved, "y", ["control"]);
  await content(moved, `A${savedContent}B`, file);
  await key(moved, "z", ["control"]);
  await content(moved, `A${savedContent}`, file);
  console.log("PASS transferred Undo/Redo groups, redo branch, selection, CRLF, BOM, dirty state and unique tab label");

  // Shared settings must update existing windows as well as newly created ones.
  await evaluate(first, 'document.querySelector("#toggleTabPaths").click()');
  await until(() => evaluate(moved, 'Boolean(document.querySelector(".tab.active .tab-name-description").textContent)'), "path preference enabled across windows");
  await evaluate(first, 'document.querySelector("#toggleTabPaths").click()');
  await until(() => evaluate(moved, 'document.querySelector(".tab.active .tab-name-description").textContent === ""'), "path preference disabled across windows");

  // A matching tab at the destination must not consume either editor's changes.
  const collision = await evaluate(first, `window.electronAPI.sendTabToWindow(${moved.id}, {transferMove:true,name:"history.txt", path:${JSON.stringify(file)}, content:"different unsaved edit", isFileSaved:false})`);
  assert.equal(collision.success, false);
  await content(moved, `A${savedContent}`, file);
  const missing = await evaluate(first, 'window.electronAPI.sendTabToWindow(2147483647, {name:"missing",content:"keep me"})');
  assert.equal(missing.success, false);

  // A second move must retain the future stack, not just the first move's Undo.
  moved.webContents.send("load-tab-data", { name: "keeper.txt", content: "second keeper", isFileSaved: false, originalContent: "" });
  await content(moved, "second keeper");
  await evaluate(moved, 'Array.from(document.querySelectorAll(".tab")).find(t => t.querySelector(".tab-name-label").textContent === "history.txt").click()');
  const again = await detach(moved);
  await content(again, `A${savedContent}`, file);
  await key(again, "y", ["control"]);
  await content(again, `A${savedContent}B`, file);
  await key(again, "Home", ["control"]);
  await type(again, "C");
  await content(again, `CA${savedContent}B`, file);
  await key(again, "z", ["control"]);
  await content(again, `A${savedContent}B`, file);
  await key(again, "z", ["control"]);
  await content(again, `A${savedContent}`, file);
  console.log("PASS repeated transfer, new edits after transfer, shared path preference and safe duplicate/missing target rejection");

  // Notes use a separate receiving path; their history must survive it too.
  const note = await evaluate(first, 'window.electronAPI.createNote({content:"note",title:"note",folderPath:""})');
  first.webContents.send("load-tab-data", { isNote: true, noteId: note.id, notePath: note.path, name: "note", content: "note" });
  await until(() => evaluate(first, 'document.querySelector(".tab.active").classList.contains("note")'), "note loaded");
  await type(first, "edited");
  const movedNote = await detach(first);
  await until(() => evaluate(movedNote, 'document.querySelector(".tab.active .tab-name-label").textContent.includes("edited")'), "edited note transferred");
  await key(movedNote, "z", ["control"]);
  await until(() => evaluate(movedNote, 'document.querySelector(".tab.active .tab-name-label").textContent === "note"'), "note undo");
  await key(movedNote, "y", ["control"]);
  await until(() => evaluate(movedNote, 'document.querySelector(".tab.active .tab-name-label").textContent.includes("edited")'), "note redo");
  console.log("PASS note Undo/Redo through its independent transfer route");

  // Losing the new window before receipt must keep the source model editable.
  await evaluate(first, 'document.querySelector("#newTabBtn").click(); document.querySelector(".tab").click()');
  expectMoveFailure();
  app.once("browser-window-created", (_event, win) => setTimeout(() => win.destroy(), 0));
  await menu(first);
  await evaluate(first, 'document.querySelector("[data-action=openInNewWindow]").click()');
  await until(() => moveFailures() === 1, "failed handoff reported");
  await content(first, "keeper");
  await key(first, "z", ["control"]);
  await content(first, "");
  await key(first, "y", ["control"]);
  await content(first, "keeper");
  const movedDraft = await detach(first);
  await content(movedDraft, "keeper");
  await key(movedDraft, "z", ["control"]);
  await content(movedDraft, "");
  await key(movedDraft, "y", ["control"]);
  await content(movedDraft, "keeper");
  console.log("PASS failed window handoff preserves the original tab/history, and untitled Undo/Redo survives transfer");
};
