const assert = require('node:assert/strict');
const fs = require('node:fs');
const { BrowserWindow, ipcMain } = require('electron');

module.exports = async ({ win, q, open, select, split, action, key, focus, tabMenu, activeName, visible, capture, until, delay, ready, evaluate }) => {
  BrowserWindow.prototype.show.call(win); win.focus();
  const a = await open('follow-a.txt', 'FOLLOW A');
  await open('follow-b.txt', 'FOLLOW B');
  await open('follow-c.txt', 'FOLLOW C');
  await tabMenu('follow-a.txt');
  assert.equal(await q("document.querySelector('[data-action=clearSplit]').matches(':disabled.disabled')"), true);
  const order = await q("Array.from(document.querySelectorAll('#tab-context-menu > button'),b=>b.dataset.action)");
  assert.equal(order.indexOf('togglePin') + 1, order.indexOf('openSplitMenu'));
  assert.equal(order.indexOf('openSplitMenu') + 1, order.indexOf('clearSplit'));
  assert.equal(order.indexOf('clearSplit') + 1, order.indexOf('reopenClosedTab'));

  async function hoverSubmenu(edge) {
    await tabMenu('follow-a.txt');
    if (edge) await q(`document.querySelector('#tab-context-menu').style.left=(innerWidth-document.querySelector('#tab-context-menu').offsetWidth-2)+'px'`);
    const point = await q("(() => {const r=document.querySelector('[data-action=openSplitMenu]').getBoundingClientRect();return {x:Math.round(r.left+40),y:Math.round(r.top+12)}})()");
    win.webContents.sendInputEvent({type:'mouseMove', ...point});
    await until(() => q("document.querySelector('#tab-split-menu').style.display==='flex'"), 'hover submenu');
    const layout = await q(`(() => {
      const p=document.querySelector('#tab-context-menu'), m=document.querySelector('#tab-split-menu'), r=m.getBoundingClientRect(), a=p.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,parentLeft:a.left,parentRight:a.right,
        hit:m.contains(document.elementFromPoint(r.left+20,r.top+15)),
        borderHit:m.contains(document.elementFromPoint(r.left >= a.left ? r.left+.5 : r.right-.5,r.top+15)),
        font:getComputedStyle(m.querySelector('button')).fontSize, parentFont:getComputedStyle(p.querySelector('button')).fontSize};
    })()`);
    assert.equal(layout.hit, true, 'flyout escapes the scroll container without clipping');
    assert.equal(layout.font, layout.parentFont);
    assert.ok(layout.left >= 0 && layout.right <= 1200 && layout.bottom <= 850);
    assert.equal(edge ? layout.right - layout.parentLeft : layout.parentRight - layout.left, 1, 'submenu overlaps the parent border by one pixel');
    assert.equal(layout.borderHit, true, 'child paints above the shared border');
    await capture(edge ? 'followup-menu-left' : 'followup-menu-right');
    // Move into the child; it must stay open.
    win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(layout.left+30),y:Math.round(layout.top+18)});
    await delay(180);
    assert.equal(await q("document.querySelector('#tab-split-menu').style.display"), 'flex');
  }
  await hoverSubmenu(false); await hoverSubmenu(true);
  await q("document.querySelector('[data-split-side=right]').click()");
  await until(() => q("document.querySelector('#editor-area').dataset.split==='right'"), 'right split');
  await tabMenu('follow-a.txt');
  assert.deepEqual(await q("Array.from(document.querySelectorAll('#tab-split-menu button.active'),b=>b.dataset.splitSide)"), ['right']);
  assert.equal(await q("document.querySelector('.split-indicator')"), null);
  assert.equal(await q("document.querySelector('.split-button').classList.contains('codicon-split-horizontal')"), true);
  await q("document.querySelector('.split-button').click()");
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), '');
  // Monaco bindings and chord target the editor that invoked them.
  await select('follow-a.txt'); await focus('primary'); await key('\\', ['control']);
  await until(() => q("document.querySelector('#editor-area').dataset.split==='right'"), 'Ctrl-backslash');
  await focus('split'); await key('k', ['control']); await key('\\', ['control']);
  await until(() => q("document.querySelector('#editor-area').dataset.split==='top'"), 'Ctrl-K Ctrl-backslash');
  assert.equal(await q("document.querySelector('.split-button').classList.contains('codicon-split-vertical')"), true);
  await key('F1'); await win.webContents.insertText('Split Down');
  await until(() => q("Array.from(document.querySelectorAll('.quick-input-list .monaco-list-row')).filter(n=>n.offsetHeight&&n.textContent.includes('Split Down')).length===1"), 'split command in palette');
  await key('Enter');
  await until(() => q("document.querySelector('#editor-area').dataset.split==='bottom'"), 'palette split down');

  // External warning replaces the split button; only closing the split remains enabled.
  await focus('split'); await win.webContents.insertText('LOCAL ');
  fs.writeFileSync(a, 'EXTERNAL A', 'utf8');
  await until(() => q("Boolean(document.querySelector('.tab[data-split=bottom] .reload-button'))"), 'fixed warning');
  assert.equal(await q("document.querySelectorAll('.tab[data-split=bottom] .split-button').length"), 0);
  await q("document.querySelector('.tab[data-split=bottom] .reload-button').click()");
  await until(() => q("document.querySelector('#tab-context-menu').style.display==='flex'"), 'warning menu');
  assert.equal(await q("Array.from(document.querySelectorAll('#tab-context-menu [data-action=openSplitMenu],#tab-context-menu [data-split-side]')).every(b=>b.disabled&&b.classList.contains('external-action-disabled'))"), true);
  assert.equal(await q("document.querySelector('[data-action=clearSplit]').disabled"), false);
  await q("document.querySelector('[data-action=openSplitMenu]').dispatchEvent(new MouseEvent('mouseenter'))");
  assert.equal(await q("document.querySelector('#tab-split-menu').style.display"), 'none');
  await capture('followup-warning-menu');
  await q("document.querySelector('[data-action=clearSplit]').click()");
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), '');
  await q("document.querySelector('.tab.active .reload-button').click()");
  await until(() => q("document.querySelector('#tab-context-menu').style.display==='flex'"), 'unsplit warning menu');
  assert.equal(await q("document.querySelector('[data-action=clearSplit]').matches(':disabled.disabled')"), true);
  await split('follow-a.txt', 'left');
  await action('diffView', 'follow-a.txt');
  await until(() => q("Boolean(document.querySelector('.file-diff-host:not([hidden])'))"), 'fixed diff');
  await q("document.querySelector('.editor-pane[data-pane=split] .modified .native-edit-context').focus()");
  await key('\\', ['control']);
  await until(() => q("document.querySelector('#editor-area').dataset.split==='right'"), 'shortcut from diff');
  await action('reloadDisk', 'follow-a.txt');
  await until(() => q("Boolean(document.querySelector('.tab[data-split=right] .split-button'))"), 'split button returns after warning');
  await capture('followup-fixed-button');

  // Use the real renderer drag path. Only the OS hit-test is substituted so a
  // deterministic drop can target another isolated test window.
  let dropTarget = null;
  ipcMain.removeHandler('window:getIdAt');
  ipcMain.handle('window:getIdAt', () => dropTarget);
  async function drag(name, target = null) {
    dropTarget = target?.id || null;
    await delay(350); // Tab width animation blocks new drags until it finishes.
    const before = BrowserWindow.getAllWindows();
    await q(`(() => { const t=Array.from(document.querySelectorAll('.tab')).find(t=>t.querySelector('.tab-name-label').textContent===${JSON.stringify(name)}),r=t.getBoundingClientRect();t.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:r.left+40,clientY:18})); })()`);
    await until(() => q("document.body.classList.contains('tab-dragging')"), 'drag started');
    await delay(100);
    await q("document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:300,clientY:200,screenX:500,screenY:300}))");
    await until(() => q("Boolean(document.querySelector('.tab.dragging-tab[style*=none]'))"), 'tab detached from strip');
    await q("document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:300,clientY:200,screenX:500,screenY:300}))");
    await until(() => q(`!Array.from(document.querySelectorAll('.tab')).some(t=>t.querySelector('.tab-name-label').textContent===${JSON.stringify(name)})`), 'source removal');
    const moved = target || await until(() => BrowserWindow.getAllWindows().find(w=>!before.includes(w)&&w.webContents.getURL().includes('index.html')), 'external window');
    await ready(moved);
    await until(() => evaluate(moved, `Array.from(document.querySelectorAll('.tab-name-label')).some(t=>t.textContent===${JSON.stringify(name)})`), 'target received');
    return moved;
  }
  await select('follow-b.txt');
  const target = await drag('follow-a.txt');
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), '', 'moving fixed pane cancels split');
  assert.equal((await visible()).length, 1);
  assert.ok((await visible())[0].text.includes('FOLLOW B'));
  await open('follow-d.txt', 'FOLLOW D');
  await split('follow-b.txt', 'right');
  await select('follow-c.txt'); await select('follow-d.txt');
  await drag('follow-d.txt', target);
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), 'right');
  assert.ok((await visible()).find(p=>p.name==='primary').text.includes('FOLLOW C'), 'normal pane uses previous active document');
  assert.ok((await visible()).find(p=>p.name==='split').text.includes('FOLLOW B'));
  await capture('followup-drag-normal');
  await drag('follow-c.txt', target);
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), '', 'no normal replacement cancels split');
  assert.equal((await visible()).length, 1);
  assert.equal(await activeName(), 'follow-b.txt');
  await open('follow-e.txt', 'FOLLOW E'); await split('follow-b.txt', 'bottom');
  await drag('follow-b.txt', target);
  assert.equal(await q("document.querySelector('#editor-area').dataset.split"), '', 'fixed pane joining another window cancels split');
  assert.ok((await visible())[0].text.includes('FOLLOW E'));
  target.destroy();
  console.log('PASS split flyout placement/styles/checkmarks, icon/warning priority, shortcuts/palette/diff commands and drag transfers with replacement/unsplit');
};
