const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, evaluate, until, type, menu, delay }) => {
  const q = expression => evaluate(win, expression);
  const visible = () => q('document.querySelector("#file-diff-view")?.hidden === false');
  const file = path.join(profile, "diff-commands.txt");
  async function key(keyCode, modifiers = []) {
    win.webContents.focus();
    for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({ type, keyCode, modifiers });
    await delay(150);
  }
  async function focus(selector) {
    await q(`document.querySelector(${JSON.stringify(selector + " .native-edit-context, " + selector + " textarea.inputarea")}).focus()`);
  }
  async function toggle(expected) {
    await key("D", ["control", "alt"]);
    await until(async () => await visible() === expected, "shortcut toggles once");
    await delay(200);
    assert.equal(await visible(), expected, "no duplicate global key handling");
  }
  async function capture(name) {
    await q("Promise.race([new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), new Promise(resolve => setTimeout(resolve, 250))])");
    await delay(100);
    fs.writeFileSync(path.join(profile, name), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  }
  async function checkMenu() {
    await until(() => q('Boolean(document.querySelector(".monaco-menu-container .action-menu-item"))'), "Monaco menu");
    const style = await q(`(() => {
      const menu = document.querySelector('.monaco-menu-container > .monaco-scrollable-element');
      const row = menu.querySelector('.action-menu-item[role=menuitem]');
      const app = document.querySelector('#custom-context-menu');
      const a = getComputedStyle(menu), b = getComputedStyle(app), r = getComputedStyle(row);
      return { background: a.backgroundColor, appBackground: b.backgroundColor, border: a.borderTopColor,
        appBorder: b.borderTopColor, shadow: a.boxShadow, appShadow: b.boxShadow, radius: a.borderRadius,
        height: row.getBoundingClientRect().height, font: getComputedStyle(row.querySelector('.action-label')).fontSize,
        color: r.color, appColor: getComputedStyle(app.querySelector('button')).color,
        family: r.fontFamily, appFamily: getComputedStyle(app.querySelector('button')).fontFamily };
    })()`);
    assert.equal(style.background, style.appBackground);
    assert.equal(style.border, style.appBorder);
    assert.equal(style.shadow, style.appShadow);
    assert.equal(style.color, style.appColor);
    assert.equal(style.family, style.appFamily);
    assert.equal(style.radius, "5px");
    assert.equal(style.height, 26);
    assert.equal(style.font, "13px");
    const hit = await q(`(() => { const row = document.querySelector('.monaco-menu-container .action-menu-item[role=menuitem]');
      const rect = row.getBoundingClientRect(), target = document.elementFromPoint(rect.left + 20, rect.top + 13);
      return {ok:row.contains(target), rect:rect.toJSON(), target:target?.outerHTML, menu:row.closest('.context-view').outerHTML.slice(0,600)}; })()`);
    assert.equal(hit.ok, true, "menu is visible and clickable: " + JSON.stringify(hit));
  }
  fs.writeFileSync(file, "alpha\nbeta\ngamma", "utf8");
  await capture("initial.png"); // Force the first paint/ready-to-show in the hidden test window.
  await delay(2200); // Let the delayed startup focus run before exercising popup focus.
  win.webContents.send("open-file", file);
  await until(() => q('document.querySelector(".tab.active .tab-name-label").textContent === "diff-commands.txt"'), "file open");
  await focus("#editor");
  await toggle(false); // No differences: command is a no-op, matching the disabled menu.
  await type(win, "LOCAL ");
  await menu(win);
  assert.equal(await q('document.querySelector("[data-action=diffView] .shortcut").textContent'), "Ctrl + Alt + D");
  await q('document.querySelector("#tab-context-menu").style.display = "none"');
  win.setSize(1400, 800);
  await focus("#editor");
  await toggle(true);
  await until(() => q('document.querySelector("#file-diff-view .monaco-diff-editor")?.classList.contains("side-by-side")'), "split mode");
  const anchor = await q(`(() => { const line = document.querySelector('#file-diff-view .modified .view-line');
    const rect = line.getBoundingClientRect();
    return { x: Math.round(rect.left + 30), y: Math.round(rect.top + 8) }; })()`);
  for (const type of ["mouseDown", "mouseUp"]) win.webContents.sendInputEvent({ type, button: "right", clickCount: 1, ...anchor });
  await checkMenu();
  await capture("diff-context-menu.png");
  await key("Escape");
  await focus("#file-diff-view .original");
  await toggle(false);
  await toggle(true);
  await focus("#file-diff-view .modified");
  await toggle(false);
  // Palette registration works in the normal editor and both diff panes.
  for (const selector of ["#editor", "#file-diff-view .original", "#file-diff-view .modified"]) {
    if (selector !== "#editor" && !await visible()) await toggle(true);
    await focus(selector);
    await key("F1");
    await until(() => q('Array.from(document.querySelectorAll(".quick-input-widget")).some(n => n.offsetHeight)'), "palette open");
    await win.webContents.insertText("Toggle Diff View");
    await until(() => q('Array.from(document.querySelectorAll(".quick-input-list")).some(n => n.offsetHeight && n.textContent.includes("Toggle Diff View"))'), "diff command in palette");
    assert.equal(await q('Array.from(document.querySelectorAll(".quick-input-list .monaco-list-row")).filter(n => n.offsetHeight && n.textContent.includes("Toggle Diff View")).length'), 1);
    const wasVisible = await visible();
    await key("Enter");
    await until(async () => await visible() !== wasVisible, "palette command executed");
  }
  // The same binding works when focus is on a toolbar button instead of Monaco.
  await q('document.querySelector("#menu-button").focus()');
  await toggle(true);
  win.setSize(700, 750);
  await until(() => q('!document.querySelector("#file-diff-view .monaco-diff-editor").classList.contains("side-by-side")'), "inline mode");
  await until(() => q('document.querySelector("#file-diff-view .modified .lightbulb-glyph")?.getBoundingClientRect().height > 0'), "inline lightbulb rendered");
  await focus("#file-diff-view .modified");
  const minus = await q(`(() => { const rect = document.querySelector('#file-diff-view .modified .inline-deleted-margin-view-zone .delete-sign').getBoundingClientRect();
    return {x:Math.round(rect.left + rect.width / 2), y:Math.round(rect.top + rect.height / 2)}; })()`);
  win.webContents.sendInputEvent({type:"mouseMove", ...minus});
  await until(() => q('getComputedStyle(document.querySelector("#file-diff-view .modified .lightbulb-glyph")).visibility === "visible"'), "minus hover reveals lightbulb");
  for (const type of ["mouseDown", "mouseUp"]) win.webContents.sendInputEvent({type, button:"left", clickCount:1, ...minus});
  await checkMenu();
  assert.equal(await q('document.querySelector(".monaco-menu-container").textContent.includes("Copy changed line")'), true);
  await capture("diff-lightbulb-menu.png");
  await key("Enter");
  await until(() => q('globalThis.__copiedPath === "alpha\\n"'), "lightbulb copies disk line");
  assert.equal(fs.readFileSync(file, "utf8"), "alpha\nbeta\ngamma");
  console.log("PASS diff menu styling, lightbulb copy, shortcut from all editors/toolbar and command palettes");
};
