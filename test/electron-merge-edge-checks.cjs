const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { BrowserWindow } = require("electron");
module.exports = async ({first, profile, evaluate, until, type, menu, delay, ready, setCheckpointHook, expectExternalError, externalErrors}) => {
  let win = first;
  const file = path.join(profile,"edges.txt"), base="one\ntwo\nthree", disk="one\ntwo\nDISK three";
  let local="LOCAL one\ntwo\nthree";
  const q = expression => evaluate(win,expression);
  const content = value => until(async () => (await q('window.electronAPI.getSessionWindowState()')).snapshot?.tabs.find(t=>t.path===file && t.content===value),`edge content ${value}`);
  async function action(name) {
    await menu(win);
    await until(() => q(`!document.querySelector('[data-action="${name}"]').disabled`),`edge ${name}`);
    await q(`document.querySelector('[data-action="${name}"]').click()`);
  }
  await type(win,"keeper");
  fs.writeFileSync(file,base,"utf8"); win.webContents.send("open-file",file);
  await until(() => q('document.querySelector(".tab.active .tab-name-label").textContent==="edges.txt"'),"edge file open");
  await type(win,"LOCAL "); await content(local);
  fs.writeFileSync(file,disk,"utf8");
  expectExternalError("Simulated checkpoint failure");
  setCheckpointHook(async () => {throw new Error("Simulated checkpoint failure");});
  await action("mergeChanges"); await until(()=>externalErrors()===1,"failure reported");
  await content(local); assert.equal(fs.readFileSync(file,"utf8"),disk);
  // Editing remains possible while the operation backs up; a changed version aborts it.
  let release, entered=false;
  setCheckpointHook(()=>{entered=true; return new Promise(resolve=>{release=resolve;});});
  expectExternalError("changed");
  await action("mergeChanges"); await until(()=>entered,"checkpoint pending");
  await type(win,"X"); local="LOCAL Xone\ntwo\nthree";
  await content(local); release();
  await until(()=>externalErrors()===2,"edited version rejected"); await content(local);
  expectExternalError("changed");
  setCheckpointHook(async()=>{fs.writeFileSync(file,disk+"\nfour","utf8");});
  await action("mergeChanges"); await until(()=>externalErrors()===3,"disk race rejected"); await content(local);
  console.log("PASS checkpoint failure and local/disk edits during backup leave content intact");
  fs.writeFileSync(file,disk,"utf8");
  await action("diffView");
  await until(()=>q('document.querySelector("#file-diff-view")?.hidden === false'),"edge diff shown");
  // Repeatedly cancel in-flight Monaco comparisons before their models disappear.
  for (let i=0;i<12;i++) {
    await action("diffView");
    await action("diffView");
    await until(()=>q('document.querySelector("#file-diff-view")?.hidden === false'),"rapid diff toggle");
  }
  const before=BrowserWindow.getAllWindows();
  await action("openInNewWindow");
  win=await ready(await until(()=>BrowserWindow.getAllWindows().find(w=>!before.includes(w)),"diff detached window"));
  await content(local);
  await until(()=>q('document.querySelector("#file-diff-view")?.hidden === false && Boolean(document.querySelector(".tab.active .reload-button"))'),"detached diff warning");
  await action("mergeChanges");
  await content("LOCAL Xone\ntwo\nDISK three");
  console.log("PASS detached diff retains readonly mode, warning and common merge base");
  // Missing files retain an explicit exit from diff mode instead of a frozen normal editor.
  fs.unlinkSync(file);
  await until(()=>q('Boolean(document.querySelector(".tab.active .name.warn"))'),"missing file warning");
  await action("diffView");
  await until(()=>q('document.querySelector("#file-diff-view").hidden'),"missing diff exited");
  fs.writeFileSync(file,disk,"utf8");
  // A transferred legacy backup with no known base can be compared but not guessed into a merge.
  const legacy=path.join(profile,"legacy.txt"); fs.writeFileSync(legacy,"disk","utf8");
  win.webContents.send("load-tab-data",{name:"legacy.txt",path:legacy,content:"unsaved",originalContent:"old",mergeBaseContent:null,isFileSaved:false});
  await until(()=>q('document.querySelector(".tab.active .tab-name-label").textContent==="legacy.txt"'),"legacy loaded");
  await menu(win);
  await until(()=>q('!document.querySelector("[data-action=diffView]").disabled'),"legacy diff enabled");
  assert.equal(await q('document.querySelector("[data-action=mergeChanges]").disabled'),true);
  const note=await q('window.electronAPI.createNote({content:"note",title:"note",folderPath:""})');
  win.webContents.send("load-tab-data",{isNote:true,noteId:note.id,notePath:note.path,name:"note",content:"note"});
  await until(()=>q('document.querySelector(".tab.active").classList.contains("note")'),"note loaded");
  await menu(win);
  assert.equal(await q('["diffView","mergeChanges","reloadDisk"].every(a=>document.querySelector(`[data-action="${a}"]`).disabled)'),true);
  console.log("PASS missing-file exit, legacy unknown-base restriction and note exclusion");
  // Explicit BOM changes on disk do not override the working copy's BOM during a merge.
  const bomFile=path.join(profile,"bom.txt"); fs.writeFileSync(bomFile,"\ufeff"+base,"utf8");
  win.webContents.send("open-file",bomFile);
  await until(()=>q('document.querySelector(".tab.active .tab-name-label").textContent==="bom.txt"'),"BOM file");
  await type(win,"LOCAL "); fs.writeFileSync(bomFile,"LOCAL "+base,"utf8");
  await action("mergeChanges");
  const bomState=await until(async()=> (await q('window.electronAPI.getSessionWindowState()')).snapshot.tabs.find(t=>t.path===bomFile && t.dirty),"BOM remains dirty");
  assert.equal(bomState.hasBom,true); assert.equal(fs.readFileSync(bomFile,"utf8"),"LOCAL "+base);
  console.log("PASS a merge preserves the working BOM and its unsaved status independently of text");
};
