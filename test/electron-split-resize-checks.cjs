const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, phase, evaluate, until, delay, ready }) => {
  const q = expression => evaluate(win, expression);
  const geometry = () => q(`(() => {
    const root=document.querySelector('#editor-area'), h=document.querySelector('#split-resize-handle');
    const panes=[...root.querySelectorAll('.editor-pane:not([hidden])')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    const r=h.getBoundingClientRect(),a=root.getBoundingClientRect(),t=document.querySelector('.tab.active').getBoundingClientRect();
    return {side:root.dataset.split,panes,handle:{x:r.x+r.width/2,y:r.y+r.height/2},ratio:Number(h.getAttribute('aria-valuenow')),
      dragging:document.body.classList.contains('split-resizing'),active:document.querySelector('.tab.active .tab-name-label').textContent,
      overlap:Boolean(document.elementFromPoint((t.left+t.right)/2,a.top+.25)?.closest('.tab.active')),
      overflow:document.body.scrollWidth>innerWidth};
  })()`);
  async function action(name, side) {
    await q(`document.querySelector('.tab.active').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:140,clientY:20}));`);
    if (side) await q(`document.querySelector('[data-action=openSplitMenu]').dispatchEvent(new MouseEvent('mouseenter')); document.querySelector('[data-split-side=${side}]').click()`);
    else {
      await until(() => q(`!document.querySelector('#tab-context-menu [data-action=${name}]').disabled && !document.querySelector('#tab-context-menu [data-action=${name}]').classList.contains('disabled')`), `${name} enabled`);
      await q(`document.querySelector('#tab-context-menu [data-action=${name}]').click()`);
    }
    await delay(200);
  }
  async function dragTo(ratio, release = true) {
    const before = await geometry();
    const target = await q(`(() => { const n=document.querySelector('#editor-area'),r=n.getBoundingClientRect();return {
      width:n.clientWidth-1,height:n.clientHeight-1,x:r.left+n.clientLeft+(n.clientWidth-1)*${ratio}+.5,y:r.top+n.clientTop+(n.clientHeight-1)*${ratio}+.5};})()`);
    await q("globalThis.__resizeFocus = document.activeElement");
    win.webContents.sendInputEvent({ type: "mouseMove", x: Math.round(before.handle.x), y: Math.round(before.handle.y) });
    win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x: Math.round(before.handle.x), y: Math.round(before.handle.y) });
    await until(async () => (await geometry()).dragging, "pointer capture begins");
    const horizontal = ["left", "right"].includes(before.side);
    const point = { x: Math.round(horizontal ? target.x : before.handle.x), y: Math.round(horizontal ? before.handle.y : target.y) };
    win.webContents.sendInputEvent({ type: "mouseMove", modifiers: ["leftButtonDown"], ...point });
    const available = horizontal ? target.width : target.height;
    const minimum = Math.min(horizontal ? 240 : 160, available / 2) / available;
    const expected = Math.max(minimum, Math.min(1-minimum, ratio));
    await until(async () => Math.abs((await geometry()).ratio - expected * 100) <= 1, "live divider follows drag").catch(async e => { console.log(await geometry()); throw e; });
    assert.equal((await geometry()).active, before.active, "drag preserves active tab");
    if (release) {
      win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point });
      await until(async () => !(await geometry()).dragging, "drag ends");
      assert.equal(await q("document.activeElement === __resizeFocus"), true, "drag preserves editor focus");
    }
  }
  async function checkHorizontalHighlight() {
    const point = await q(`(() => {
      const h=document.querySelector('#split-resize-handle').getBoundingClientRect();
      const m=document.querySelector('.editor-pane:not([hidden]) .minimap').getBoundingClientRect();
      return {x:Math.round((m.left+m.right)/2),y:Math.round(h.top+1)};
    })()`);
    win.webContents.sendInputEvent({type:'mouseMove',...point});
    await delay(500);
    assert.equal(await q(`(() => {
      const h=document.querySelector('#split-resize-handle'),r=h.getBoundingClientRect();
      for(let x=r.left+1;x<r.right;x+=8) for(const y of [r.top+.25,r.bottom-.25]) {
        if(document.elementFromPoint(x,y)!==h) return false;
      }
      return getComputedStyle(h,'::after').opacity==='1';
    })()`),true,'horizontal highlight stays above minimaps and scrollbars along its full width');
    const dir=path.join(__dirname,'..','output','playwright','split-view');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,`highlight-${(await geometry()).side}.png`),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  if (phase === "split-resize-restore") {
    await until(async () => (await geometry()).side === "bottom", "split restored");
    assert.equal((await geometry()).ratio, 36);
    await action(null, "right");
    assert.equal((await geometry()).ratio, 70);
    await q("[...document.querySelectorAll('.tab')].find(t=>t.querySelector('.tab-name-label').textContent==='resize-a.txt').click()");
    await action('openInNewWindow');
    const child = await ready(await until(() => require('electron').BrowserWindow.getAllWindows().find(w=>w!==win), 'external window'));
    const childFile=path.join(profile,'resize-child.txt');fs.writeFileSync(childFile,'Child window','utf8');
    child.webContents.send('open-file', childFile);
    await until(()=>evaluate(child,"document.querySelector('.tab.active .tab-name-label').textContent==='resize-child.txt'"),'external second tab');
    await evaluate(child,"document.querySelector('.tab.active').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:140,clientY:20})); document.querySelector('[data-action=openSplitMenu]').dispatchEvent(new MouseEvent('mouseenter')); document.querySelector('[data-split-side=right]').click()");
    await until(()=>evaluate(child,"document.querySelector('#split-resize-handle').getAttribute('aria-valuenow')==='50'"),'external starts at equal ratio');
    console.log("PASS independent split ratios restored from session; transferred tab does not carry window ratio");
    return;
  }
  require("electron").BrowserWindow.prototype.show.call(win);
  win.focus();
  win.setSize(1200, 850);
  for (const name of ["resize-a.txt", "resize-b.txt"]) {
    const file = path.join(profile, name);
    fs.writeFileSync(file, Array.from({length: 2500}, (_, i) => `${i}: ${"折り返し wrapped line ".repeat(8)}`).join("\n"), "utf8");
    win.webContents.send("open-file", file);
    await until(() => q(`document.querySelector('.tab.active .tab-name-label').textContent===${JSON.stringify(name)}`), name);
  }
  await action(null, "right");
  assert.equal(await q("document.querySelector('#split-resize-handle').tabIndex"), -1);
  assert.equal(await q("document.querySelector('#split-resize-handle').title"), 'Resize split panes (double-click to reset)');
  await dragTo(0.7);
  await action(null, "left");
  assert.equal((await geometry()).ratio, 70, "physical ratio survives side swap");
  await action(null, "bottom"); assert.equal((await geometry()).ratio, 50);
  await dragTo(0); assert.ok(Math.abs((await geometry()).panes[0].h-160)<1, "top minimum height");
  await dragTo(1); assert.ok(Math.abs((await geometry()).panes[1].h-160)<1, "bottom minimum height");
  await dragTo(0.36);
  await checkHorizontalHighlight();
  await action(null, "top"); assert.equal((await geometry()).ratio, 36);
  await checkHorizontalHighlight();
  await action(null, "right"); assert.equal((await geometry()).ratio, 70);
  await dragTo(0); assert.ok(Math.abs((await geometry()).panes[0].w-240)<1, 'left minimum width');
  await dragTo(1); assert.ok(Math.abs((await geometry()).panes[1].w-240)<1, 'right minimum width');
  await dragTo(0.66, false);
  await q("window.dispatchEvent(new Event('blur'))");
  assert.equal((await geometry()).dragging, false);
  await dragTo(0.62, false); await q("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); assert.equal((await geometry()).dragging, false);
  await q("document.querySelector('#split-resize-handle').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
  await delay(100); assert.equal((await geometry()).ratio, 50);
  await dragTo(0.7);
  await q("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB',ctrlKey:true,bubbles:true}))");
  await delay(300);
  assert.equal(await q("document.body.classList.contains('side-panel-open')"), true);
  win.setSize(500, 500); await delay(350);
  let g = await geometry(); assert.ok(g.panes.every(p => p.w > 0)); assert.equal(g.overflow, false); assert.equal(g.overlap, true);
  win.setSize(1200,850); await delay(350); assert.equal((await geometry()).ratio,70, "expansion restores preferred ratio");
  // Both the normal editor and inline diff use the same live pane geometry.
  const activeFile=path.join(profile,'resize-b.txt');
  await q("document.querySelector('.editor-pane[data-pane=split] .native-edit-context, .editor-pane[data-pane=split] textarea').focus()");
  win.webContents.focus(); await delay(100);
  await win.webContents.insertText('LOCAL ');
  await until(()=>q("document.querySelector('.tab.active .close').classList.contains('show-unsaved')"),'local edit');
  fs.appendFileSync(activeFile,'\nDISK CHANGE','utf8');
  await action('diffView');
  await until(()=>q("Boolean(document.querySelector('.file-diff-host:not([hidden])'))"),'diff shown');
  await dragTo(0.6); await action(null,'bottom'); await dragTo(0.36);
  assert.equal(await q("document.querySelectorAll('.file-diff-host:not([hidden]) .side-by-side').length"),0);
  const dir=path.join(__dirname,'..','output','playwright','split-view');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'resized-bottom-sidebar.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await action('diffView');
  await action(null,'right'); await dragTo(0.65, false); await action('clearSplit');
  assert.equal((await geometry()).dragging,false,'unsplit cancels capture');
  assert.equal(await q("document.querySelector('#split-resize-handle').hidden"),true);
  await action(null,'right'); await dragTo(0.7);
  await action(null,'bottom');
  await until(async()=>{const s=await q('window.electronAPI.getSessionWindowState()');return s.snapshot?.editorLayout?.split?.side==='bottom' && Math.abs(s.snapshot?.editorLayout?.ratios?.left-.7)<.002 && Math.abs(s.snapshot?.editorLayout?.ratios?.top-.36)<.002;},'ratio snapshot');
  console.log('PASS live split drag, independent axes, editor focus/reset, cancellation, sidebar, narrow-window recovery, diff and border overlap');
};
