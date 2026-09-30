const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, evaluate, until, type, menu, delay }) => {
  const q = expression => evaluate(win, expression);
  const base = Array.from({length: 4000}, (_, i) => `${i + 1}: ${"a wrapped comparison line ".repeat(5)}`).join("\n");
  const viewport = async () => {
    // Hidden Electron windows can leave the original gutter's DOM one paint
    // behind its scroll state. Compare painted positions on both sides.
    await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    return q(`['original','modified'].map(side => {
    const n = document.querySelector('#file-diff-view .' + side + ' .margin-view-overlays .line-numbers');
    return {line:n?.textContent,top:n?.getBoundingClientRect().top};
  })`);
  };
  async function action(name) {
    await menu(win);
    await until(() => q(`!document.querySelector('[data-action="${name}"]').disabled`), name);
    await q(`document.querySelector('[data-action="${name}"]').click()`);
  }
  async function select(name) {
    return q(`(() => {
      const start=performance.now();
      Array.from(document.querySelectorAll('.tab')).find(t=>t.querySelector('.tab-name-label').textContent===${JSON.stringify(name)}).click();
      return performance.now()-start;
    })()`);
  }
  win.setSize(1400,900);
  await type(win,"keeper");
  for (const name of ["perf-a.txt", "perf-b.txt"]) {
    const file=path.join(profile,name);
    fs.writeFileSync(file,base,"utf8");win.webContents.send("open-file",file);
    await until(()=>q(`document.querySelector('.tab.active .tab-name-label').textContent===${JSON.stringify(name)}`),name);
    await type(win,"LOCAL ");fs.writeFileSync(file,base+"\nDISK","utf8");
    await action("diffView");
    await until(()=>q('document.querySelector("#file-diff-view")?.hidden === false'),"comparison visible");
    await until(()=>q('Boolean(document.querySelector("#file-diff-view .line-delete"))'),"comparison computed");
    await q(`(globalThis.__diffNodes ||= {})[${JSON.stringify(name)}] = document.querySelector('#file-diff-view .monaco-diff-editor')`);
    await delay(200);
    assert.equal(await q(`(() => {
      const surface=document.querySelector('#file-diff-view .file-diff-surface').getBoundingClientRect();
      const line=document.querySelector('#file-diff-view .modified .view-lines > .view-line').getBoundingClientRect();
      const scrollbar=document.querySelector('#file-diff-view .modified .scrollbar.vertical').getBoundingClientRect();
      return line.top-surface.top >= 12 && scrollbar.top-surface.top < 2;
    })()`),true,"line padding does not offset the scrollbar");
  }
  await q('document.querySelector("#file-diff-view .modified .native-edit-context, #file-diff-view .modified textarea.inputarea").focus()');
  win.webContents.focus();
  for(const type of ["keyDown","keyUp"])win.webContents.sendInputEvent({type,keyCode:"End",modifiers:["control"]});
  await until(()=>q('Array.from(document.querySelectorAll("#file-diff-view .modified .line-numbers")).some(n=>n.textContent==="4000")'),"comparison scrolled to end");
  await delay(300);
  const before=await viewport(), times=[];
  const destroyListeners=win.webContents.listenerCount("destroyed");
  for(let i=0;i<3;i++) {
    times.push(await q(`(() => {
      const tab=document.querySelector('.tab.active'),r=tab.getBoundingClientRect(),start=performance.now();
      tab.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:r.left+90,clientY:r.top+15}));
      return performance.now()-start;
    })()`));
    await delay(100);
    await q(`document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,buttons:1,clientX:350,clientY:18})); document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:350,clientY:18}));`);
    await delay(300);
    assert.deepEqual(await viewport(),before,"dragging the active tab preserves both scroll positions");
  }
  const switchTimes=[];
  for(let i=0;i<3;i++) {
    switchTimes.push(await select("perf-a.txt"));
    assert.equal(await q('document.querySelector("#file-diff-view .monaco-diff-editor") === __diffNodes["perf-a.txt"]'),true,"reuse first comparison");
    switchTimes.push(await select("perf-b.txt"));
    assert.equal(await q('document.querySelector("#file-diff-view .monaco-diff-editor") === __diffNodes["perf-b.txt"]'),true,"reuse second comparison");
    await delay(150);
    assert.deepEqual(await viewport(),before,"switching tabs preserves both scroll positions");
  }
  const resizeStart=Date.now();
  for(let width=1380;width>=1200;width-=20){win.setSize(width,900);await delay(20);}
  await until(()=>q('document.querySelector("#file-diff-view .monaco-diff-editor").getBoundingClientRect().width === document.querySelector("#file-diff-view .file-diff-surface").clientWidth'),"final resize applied");
  await delay(250);
  const resizeDuration=Date.now()-resizeStart;
  assert.equal(await q('document.querySelector("#file-diff-view .monaco-diff-editor") === __diffNodes["perf-b.txt"]'),true);
  win.setSize(700,800);
  await until(()=>q('!document.querySelector("#file-diff-view .monaco-diff-editor").classList.contains("side-by-side")'),"inline performance mode");
  await select("perf-a.txt");await delay(150);await select("perf-b.txt");await delay(150);
  const inlineBefore=await viewport();
  await select("perf-a.txt");await select("perf-b.txt");await delay(150);
  assert.deepEqual(await viewport(),inlineBefore,"inline cache preserves scroll too");
  // Exceed the cache limit, then reopen an evicted comparison and close it.
  for (const name of ["small-c.txt", "small-d.txt"]) {
    const file=path.join(profile,name);fs.writeFileSync(file,"small file","utf8");win.webContents.send("open-file",file);
    await until(()=>q(`document.querySelector('.tab.active .tab-name-label').textContent===${JSON.stringify(name)}`),name);
    await type(win,"LOCAL ");await action("diffView");
    await until(()=>q('document.querySelector("#file-diff-view")?.hidden === false'),"small comparison visible");
  }
  assert.equal(await q('document.querySelectorAll(".file-diff-host").length'),3,"comparison cache is bounded");
  await select("perf-a.txt");await select("perf-b.txt");
  await until(async()=>JSON.stringify(await viewport())===JSON.stringify(inlineBefore),"evicted comparison restores scroll").catch(async error=>{console.log({expected:inlineBefore,actual:await viewport()});throw error;});
  assert.equal(await q('document.querySelector("#file-diff-view .monaco-diff-editor") !== __diffNodes["perf-b.txt"]'),true,"evicted editor rebuilt");
  assert.equal(win.webContents.listenerCount("destroyed"),destroyListeners,"watch cleanup listener is not duplicated on tab switches");
  await action("diffView");
  await until(()=>q('document.querySelector("#file-diff-view").hidden'),"normal editor restored");
  assert.equal(await q('getComputedStyle(document.querySelector("#editor")).visibility'),"visible");
  console.log(`PASS 4000-line comparison reuse, stable drag/return scroll, padding and resize; drag ms=${times.map(Math.round)}, switch ms=${switchTimes.map(Math.round)}, resize burst ms=${resizeDuration}`);
};
