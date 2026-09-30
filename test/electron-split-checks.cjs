const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, phase, evaluate, until, delay, ready, expectMoveFailure, moveFailures }) => {
  const q = expression => evaluate(win, expression);
  const pane = name => `.editor-pane[data-pane="${name}"]`;
  const surface = name => `${pane(name)} > .editor-surface`;
  const visible = () => q(`Array.from(document.querySelectorAll('.editor-pane:not([hidden])')).map(p=>({name:p.dataset.pane,id:p.dataset.tabId,text:p.querySelector('.view-lines')?.textContent.replaceAll(String.fromCharCode(160), " ")}))`);
  const activeName = () => q(`document.querySelector('.tab.active .tab-name-label').textContent`);
  async function select(name) {
    await q(`Array.from(document.querySelectorAll('.tab')).find(t=>t.querySelector('.tab-name-label').textContent === ${JSON.stringify(name)}).click()`);
    await until(async () => await activeName() === name, "select " + name);
  }
  async function tabMenu(name) {
    await q(`Array.from(document.querySelectorAll('.tab')).find(t=>t.querySelector('.tab-name-label').textContent === ${JSON.stringify(name)}).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:120,clientY:20}))`);
    await until(() => q(`document.querySelector('#tab-context-menu').style.display === 'flex'`), "context menu");
  }
  async function action(name, target) {
    await tabMenu(target || await activeName());
    await q(`document.querySelector('#tab-context-menu [data-action="${name}"]').click()`);
  }
  async function split(name, side) {
    await tabMenu(name);
    await q(`document.querySelector('[data-action=openSplitMenu]').dispatchEvent(new MouseEvent('mouseenter')); document.querySelector('[data-split-side="${side}"]').click()`);
    await until(() => q(`document.querySelector('#editor-area').dataset.split === '${side}'`), "split " + side);
    await delay(100);
  }
  async function key(code, modifiers = []) {
    for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({ type, keyCode: code, modifiers });
    await delay(60);
  }
  async function focus(name) {
    win.webContents.focus();
    await q(`document.querySelector('${surface(name)} .native-edit-context, ${surface(name)} textarea.inputarea').focus()`);
    await delay(80); // Allow Chromium's native EditContext to receive the focus change before insertText.
  }
  async function insert(name, text) { await focus(name); await win.webContents.insertText(text); }
  async function open(name, content) {
    const file = path.join(profile, name);
    fs.writeFileSync(file, content, "utf8"); win.webContents.send("open-file", file);
    await until(async () => await activeName() === name, "open " + name);
    return file;
  }
  async function geometry(side) {
    await delay(250);
    const result = await q(`(() => {
      const area=document.querySelector('#editor-area'), a=area.getBoundingClientRect();
      const panes=Array.from(area.querySelectorAll('.editor-pane:not([hidden])')).map(p=>{
        const r=p.getBoundingClientRect();return {name:p.dataset.pane,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
      const t=document.querySelector('.tab.active').getBoundingClientRect();
      return {area:{x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom},panes,
        borderCovered:Boolean(document.elementFromPoint((t.left+t.right)/2,a.top+.25)?.closest('.tab.active')),
        bodyWidth:document.body.scrollWidth,viewport:innerWidth};
    })()`);
    assert.equal(result.borderCovered, true, "active tab overlaps the single top border");
    assert.ok(result.bodyWidth <= result.viewport, "no page overflow");
    assert.equal(result.panes.length, 2);
    const primary = result.panes.find(p=>p.name === "primary"), fixed = result.panes.find(p=>p.name === "split");
    const horizontal = ["left", "right"].includes(side);
    assert.ok(Math.abs(primary[horizontal ? "width" : "height"] - fixed[horizontal ? "width" : "height"]) <= 1);
    assert.equal(side === "left" ? fixed.right + 1 : side === "right" ? primary.right + 1 : side === "top" ? fixed.bottom + 1 : primary.bottom + 1,
      side === "left" ? primary.x : side === "right" ? fixed.x : side === "top" ? primary.y : fixed.y, "one pixel divider");
    for (const p of result.panes) {
      assert.ok(p.width > 0 && p.height > 0 && p.right <= result.area.right + 1 && p.bottom <= result.area.bottom + 1);
    }
  }
  async function capture(name) {
    await q("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await delay(150);
    const dir = path.join(__dirname, "..", "output", "playwright", "split-view");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + ".png"), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  }

  if (phase === "split-restore") {
    win = await until(async () => {
      for (const candidate of require("electron").BrowserWindow.getAllWindows()) {
        if (!candidate.webContents.isLoading() && await evaluate(candidate, "document.querySelector('#editor-area')?.dataset.split === 'bottom'")) return candidate;
      }
    }, "restored split window");
    await until(() => q(`document.querySelector('#editor-area').dataset.split === 'bottom'`), "split restored");
    await geometry("bottom");
    const state = await visible();
    assert.ok(state.find(p=>p.name === "split").text.includes("RESTORE FIXED"));
    assert.ok(state.find(p=>p.name === "primary").text.includes("RESTORE NORMAL"));
    assert.equal(await activeName(), "restore-fixed.txt");
    await capture("restored-bottom");
    console.log("PASS split session restores both document views and active side");
    return;
  }
  win.setSize(1200, 850);
  if (phase === 'split-followup') return require('./electron-split-followup-checks.cjs')({ win, q, open, select, split, action, key, focus, tabMenu, activeName, visible, capture, until, delay, ready, evaluate });
  if (phase === 'split-audit') {
    // Native EditContext does not reliably emit blur in a hidden window; this phase needs real focus for IME and Go to Line.
    require('electron').BrowserWindow.prototype.show.call(win); win.focus();
    const a = await open('audit-a.txt', Array.from({length: 3000}, (_, i) => `A ${i + 1} document`).join('\n'));
    const b = await open('audit-b.txt', Array.from({length: 3000}, (_, i) => `B ${i + 1} document`).join('\n'));
    await split('audit-a.txt', 'right');
    await capture('audit-initial'); await delay(1200);
    const snapshot = async () => (await q('window.electronAPI.getSessionWindowState()')).snapshot;
    async function position(name, line) {
      await focus(name);
      assert.equal(await activeName(), name === 'split' ? 'audit-a.txt' : 'audit-b.txt');
      await key('g', ['control']);
      await win.webContents.insertText(String(line)); await key('Enter');
      await key('Home'); await key('Right', ['shift']);
      await until(async () => (await snapshot())?.tabs.find(t => t.path === (name === 'split' ? a : b))?.viewState?.cursorState[0].position.lineNumber === line, 'position persisted');
    }
    await position('split', 1500); await position('primary', 700);
    const before = await snapshot();
    await q("globalThis.__auditEditors=Array.from(document.querySelectorAll('.editor-surface > .monaco-editor'))");
    for (const side of ['top', 'left', 'bottom', 'right']) await split('audit-a.txt', side);
    await action('togglePin', 'audit-a.txt');
    await action('togglePin', 'audit-a.txt');
    await until(async () => { const s = await snapshot(); return s.updatedAt > before.updatedAt && s.editorLayout.split?.side === 'right'; }, 'layout persisted');
    const after = await snapshot();
    for (const file of [a, b]) {
      const prior = before.tabs.find(t=>t.path===file), current = after.tabs.find(t=>t.path===file);
      assert.deepEqual(current.viewState.cursorState, prior.viewState.cursorState, 'orientation and pinning preserve selection');
      assert.ok(Math.abs(current.viewState.viewState.firstPosition.lineNumber - prior.viewState.viewState.firstPosition.lineNumber) <= 1, 'orientation preserves the document scroll anchor');
    }
    assert.equal(await q("__auditEditors.every(n=>n.isConnected) && document.querySelectorAll('.editor-surface > .monaco-editor').length === 2"), true);
    // Chromium's real IME composition path, including focus changing mid-composition.
    win.webContents.debugger.attach('1.3');
    try {
      await focus('split'); await key('Home', ['control']);
      await win.webContents.debugger.sendCommand('Input.imeSetComposition', {text:'にほん', selectionStart:3, selectionEnd:3});
      assert.equal(await activeName(), 'audit-a.txt');
      await win.webContents.debugger.sendCommand('Input.insertText', {text:'日本語'});
      await key('s', ['control']);
      await until(() => fs.readFileSync(a, 'utf8').startsWith('日本語'), 'fixed IME commit saved');
      await focus('primary'); await key('Home', ['control']);
      await win.webContents.debugger.sendCommand('Input.imeSetComposition', {text:'へんかん', selectionStart:4, selectionEnd:4});
      await focus('split');
      await win.webContents.debugger.sendCommand('Input.insertText', {text:'固定側'});
      await key('s', ['control']); await focus('primary'); await key('s', ['control']);
      await until(() => fs.readFileSync(a, 'utf8').includes('固定側') && fs.readFileSync(b, 'utf8').startsWith('へんかん'), 'composition stays with its source pane');
      assert.equal(fs.readFileSync(a, 'utf8').includes('へんかん'), false);
      assert.equal(fs.readFileSync(b, 'utf8').includes('固定側'), false);
    } finally { win.webContents.debugger.detach(); }
    // Deletion/recreation is observed on either side without stealing focus.
    for (const [file, name, other] of [[a, 'audit-a.txt', 'audit-b.txt'], [b, 'audit-b.txt', 'audit-a.txt']]) {
      await select(other);
      fs.unlinkSync(file);
      await until(() => q(`Array.from(document.querySelectorAll('.tab')).find(t=>t.querySelector('.tab-name-label').textContent===${JSON.stringify(name)}).querySelector('.name').classList.contains('warn')`), 'inactive file deletion');
      assert.equal(await activeName(), other);
      fs.writeFileSync(file, `RECREATED ${name}`, 'utf8');
      await until(async () => (await visible()).some(p=>p.text.includes(`RECREATED ${name}`)), 'inactive file recreation');
      assert.equal(await activeName(), other);
    }
    await capture('audit-recreated');
    console.log('PASS split selection/scroll anchors, stable editor count, pinning, Chromium IME composition/commit/focus isolation, and two-path deletion/recreation');
    return;
  }
  if (phase === 'split-edges') {
    const { app, dialog } = require('electron');
    await open('edge-a.txt', 'EDGE A');
    await open('edge-b.txt', 'EDGE B');
    await split('edge-a.txt', 'right');
    await select('edge-b.txt');
    const before = await visible();
    expectMoveFailure();
    app.once('browser-window-created', (_event, target) => setTimeout(() => target.destroy(), 0));
    await action('openInNewWindow', 'edge-a.txt');
    await until(() => moveFailures() === 1, 'split transfer failure reported');
    assert.deepEqual((await visible()).map(p=>p.id), before.map(p=>p.id));
    assert.equal(await activeName(), 'edge-b.txt');
    await insert('split', 'AFTER FAILURE '); await key('s', ['control']);
    await until(() => fs.readFileSync(path.join(profile, 'edge-a.txt'), 'utf8').includes('AFTER FAILURE'), 'failed transfer returns editable pane');
    // A pending Save As must keep its source even after focus changes.
    let releaseSave;
    const savePath = path.join(profile, 'renamed-a.txt');
    dialog.showSaveDialog = () => new Promise(resolve => { releaseSave = resolve; });
    await key('s', ['control', 'shift']);
    await until(() => releaseSave, 'Save As dialog opened');
    await focus('primary');
    releaseSave({ canceled: false, filePath: savePath });
    await until(() => fs.existsSync(savePath), 'Save As completed');
    assert.ok(fs.readFileSync(savePath, 'utf8').includes('AFTER FAILURE'));
    assert.equal(await activeName(), 'edge-b.txt');
    fs.writeFileSync(savePath, 'RENAMED EXTERNAL', 'utf8');
    await until(async () => (await visible()).find(p=>p.name==='split').text.includes('RENAMED EXTERNAL'), 'Save As updates nonactive watcher');
    // Fixing the normal tab swaps the document placement without duplicating it.
    await split('edge-b.txt', 'left');
    assert.equal(new Set((await visible()).map(p=>p.id)).size, 2);
    await geometry('left');
    await action('close', 'renamed-a.txt');
    await until(() => q("document.querySelector('#editor-area').dataset.split === ''"), 'closing normal side leaves fixed document');
    assert.equal(await activeName(), 'edge-b.txt');
    // A fixed preview must survive opening a different note preview.
    const noteA = await q("window.electronAPI.createNote({content:'NOTE A',title:'NOTE A'})");
    const noteB = await q("window.electronAPI.createNote({content:'NOTE B',title:'NOTE B'})");
    await key('b', ['control']);
    await q("document.querySelector('#notes-list-refresh').click()");
    await until(() => q(`Boolean(document.querySelector('[data-note-id="${noteA.id}"]'))`), 'notes listed');
    await q(`document.querySelector('[data-note-id="${noteA.id}"]').click()`);
    await until(async () => await activeName() === 'NOTE A', 'preview A opened');
    await split('NOTE A', 'bottom');
    assert.equal(await q("document.querySelector('.tab.active').classList.contains('preview')"), false);
    await q(`document.querySelector('[data-note-id="${noteB.id}"]').click()`);
    await until(async () => await activeName() === 'NOTE B', 'preview B opened');
    assert.ok((await visible()).find(p=>p.name==='split').text.includes('NOTE A'));
    await insert('split', 'EDITED '); await focus('primary');
    await until(async () => (await q(`window.electronAPI.readNote('${noteA.id}')`)).content.includes('EDITED'), 'nonactive note autosaved');
    // Simulate a committed note update from another window.
    await q(`window.electronAPI.writeNote({noteId:'${noteA.id}',content:'UPDATED NOTE A',title:'UPDATED NOTE A'})`);
    win.webContents.send('notes:changed', { noteId: noteA.id });
    await until(async () => (await visible()).find(p=>p.name==='split').text.includes('UPDATED NOTE A'), 'nonactive note refreshed');
    assert.equal(await activeName(), 'NOTE B');
    await capture('notes-bottom-sidebar');
    await focus('split'); await key('F1');
    await until(() => q("Array.from(document.querySelectorAll('.quick-input-widget')).some(n=>n.offsetHeight)"), 'split command palette');
    assert.equal(await q(`(() => {
      const n=Array.from(document.querySelectorAll('.quick-input-widget')).find(n=>n.offsetHeight), r=n.getBoundingClientRect();
      return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && n.contains(document.elementFromPoint(r.left+20,r.top+20));
    })()`), true, 'bottom pane palette is visible without clipping');
    await capture('bottom-palette');
    await win.webContents.insertText('Focus Other Pane');
    await until(() => q("Array.from(document.querySelectorAll('.quick-input-list .monaco-list-row')).filter(n=>n.offsetHeight && n.textContent.includes('Focus Other Pane')).length === 1"), 'single focus-other command');
    await key('Enter');
    await until(async () => await activeName() === 'NOTE B', 'palette focuses other pane');
    await tabMenu('UPDATED NOTE A');
    await q("document.querySelector('[data-action=clearSplit]').click()");
    await until(() => q("document.querySelector('#editor-area').dataset.split === ''"), 'clear split');
    assert.equal(await activeName(), 'NOTE B');
    console.log('PASS split transfer rollback, pending Save As, renamed watcher, swapping, close normalization, note previews/autosave/external updates and clear split');
    return;
  }
  const a = await open("split-a.txt", "# Fixed document\n\nAlpha\n" + "long fixed line ".repeat(30));
  const b = await open("split-b.txt", "# Normal document\n\nBravo\n" + "normal content ".repeat(30));
  await open("split-c.txt", "# Third document\n\nCharlie");
  await select("split-b.txt");
  await split("split-a.txt", "right");
  const original = await visible();
  await q(`globalThis.__fixedNode=document.querySelector('${surface("split")} .monaco-editor')`);
  await select("split-c.txt"); await select("split-a.txt");
  assert.equal((await visible()).find(p=>p.name === "primary").text.includes("Charlie"), true);
  assert.equal((await visible()).find(p=>p.name === "split").id, original.find(p=>p.name === "split").id);
  assert.equal(await q(`document.querySelector('${surface("split")} .monaco-editor') === __fixedNode`), true);
  await focus("primary"); assert.equal(await activeName(), "split-c.txt");
  await focus("split"); assert.equal(await activeName(), "split-a.txt");
  for (const side of ["left", "top", "bottom", "right"]) { await split("split-a.txt", side); await geometry(side); }
  await capture("right");
  await select("split-b.txt");
  await insert("split", "FIXED EDIT ");
  await insert("primary", "NORMAL EDIT ");
  await key("s", ["control"]);
  await until(() => fs.readFileSync(b, "utf8").includes("NORMAL EDIT"), "save normal");
  assert.equal(fs.readFileSync(a, "utf8").includes("FIXED EDIT"), false);
  await focus("split"); await key("s", ["control"]);
  await until(() => fs.readFileSync(a, "utf8").includes("FIXED EDIT"), "save fixed");
  await delay(300);
  const beforeUndo = fs.readFileSync(a, "utf8");
  await key("z", ["control"]);

  await key("s", ["control"]);
  await until(() => fs.readFileSync(a, "utf8") !== beforeUndo, "Undo stays on fixed document");
  assert.equal(fs.readFileSync(b, "utf8").includes("NORMAL EDIT"), true);
  // Both paths stay watched, including a non-active side.
  await focus("primary");
  fs.writeFileSync(a, "# External A\nEXTERNAL FIXED", "utf8");
  await until(() => q(`document.querySelector('${surface("split")} .view-lines').textContent.replaceAll(String.fromCharCode(160), " ").includes('EXTERNAL FIXED')`), "background fixed reload");
  assert.equal(await activeName(), "split-b.txt");
  fs.writeFileSync(b, "# External B\nEXTERNAL NORMAL", "utf8");
  await until(() => q(`document.querySelector('${surface("primary")} .view-lines').textContent.replaceAll(String.fromCharCode(160), " ").includes('EXTERNAL NORMAL')`), "normal reload");
  // Sidebar, line numbers, status bar and small windows retain equal panes.
  await key("b", ["control"]);
  await q(`document.querySelector('#line-num').click()`);
  for (const side of ["left", "top", "bottom", "right"]) { await split("split-a.txt", side); await geometry(side); }
  await capture("right-sidebar");
  win.setSize(700, 600); await geometry("right"); await capture("narrow-sidebar");
  await focus('split'); await key('F1');
  await until(() => q("Array.from(document.querySelectorAll('.quick-input-widget')).some(n=>n.offsetHeight)"), 'narrow palette open');
  assert.equal(await q(`(() => {
    const n=Array.from(document.querySelectorAll('.quick-input-widget')).find(n=>n.offsetHeight), r=n.getBoundingClientRect();
    return r.width>=400 && r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && n.contains(document.elementFromPoint(r.left+10,r.top+10));
  })()`), true, 'narrow split palette remains visible');
  await capture('narrow-sidebar-palette'); await key('Escape');
  await split("split-a.txt", "bottom"); await geometry("bottom"); await capture("bottom-sidebar");
  await q(`document.querySelector('#toggleStatusBar').click()`); await geometry("bottom");
  await q(`document.querySelector('#toggleStatusBar').click()`);
  await key("b", ["control"]); win.setSize(1200, 850);
  // Find belongs to the source pane; zooming an unfocused pane must not change active tab.
  await focus("split"); await key("f", ["control"]);
  assert.equal(await q(`Boolean(document.activeElement.closest('${pane("split")}'))`), true);
  await key("Escape");
  await focus("primary");
  await q(`document.querySelector('${surface("split")}').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-100}))`);
  assert.equal(await activeName(), "split-b.txt");
  // Simultaneous comparisons are read-only inline, even in a wide vertical split.
  await insert("split", "LOCAL A "); await insert("primary", "LOCAL B ");
  await action("diffView", "split-a.txt"); await action("diffView", "split-b.txt");
  await until(() => q(`document.querySelectorAll('.file-diff-host:not([hidden]) .line-delete').length >= 2`), "both differences computed");
  assert.equal(await q(`document.querySelectorAll('.file-diff-host:not([hidden]) .side-by-side').length`), 0);
  await capture("both-inline-bottom");
  await split("split-a.txt", "right"); await geometry("right"); await capture("both-inline-right");
  await select("split-c.txt"); await select("split-b.txt");
  assert.equal(await q(`document.querySelectorAll('.file-diff-host:not([hidden])').length`), 2);
  await action("diffView", "split-a.txt"); await action("diffView", "split-b.txt");
  // Close cancellation leaves both views; successful close normalizes the layout.
  await action("close", "split-a.txt");
  await until(() => q(`document.querySelector('#confirm-save').style.display === 'flex'`), "close confirmation").catch(async error => { throw error; });
  await key("Escape");
  assert.equal((await visible()).length, 2);
  // Save fixed, then externalize it while the other side remains active.
  await focus("split"); await key("s", ["control"]); await delay(200);
  await select("split-b.txt");
  await action("openInNewWindow", "split-a.txt");
  await until(() => q(`document.querySelector('#editor-area').dataset.split === ''`), "externalized fixed unsplits source");
  const { BrowserWindow } = require("electron");
  const other = BrowserWindow.getAllWindows().find(w=>w !== win);
  await ready(other);
  assert.equal(await evaluate(other, `document.querySelector('#editor-area').dataset.split`), "");
  assert.equal(await evaluate(other, `document.querySelector('.tab.active .tab-name-label').textContent`), "split-a.txt");
  other.destroy();
  // Persist a new two-pane session for a separate process to restore.
  await open("restore-normal.txt", "RESTORE NORMAL\nSecond line");
  await open("restore-fixed.txt", "RESTORE FIXED\nSecond line");
  await split("restore-fixed.txt", "bottom");
  await until(async () => {
    const result = await q(`window.electronAPI.getSessionWindowState()`);
    return result.snapshot?.editorLayout?.split?.side === "bottom";
  }, "split session persisted");
  await capture("final-bottom");
  console.log("PASS four split directions, focus, model/Undo/save isolation, two-path watching, sidebar/borders, inline diffs, cancel, externalization and session snapshot");
};
