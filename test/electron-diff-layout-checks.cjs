const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ first: win, profile, evaluate, until, type, menu, delay }) => {
  const q = expression => evaluate(win, expression);
  const file = path.join(profile, "line-numbers.txt");
  const lines = count => Array.from({length: count}, (_, i) => `line ${i + 1}`).join("\n");
  async function key(keyCode) {
    await q('document.querySelector("#file-diff-view .modified .native-edit-context, #file-diff-view .modified textarea.inputarea").focus()');
    win.webContents.focus();
    for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({type, keyCode, modifiers: ["control"]});
    await delay(100);
  }
  async function numbers() {
    return q(`Array.from(document.querySelectorAll('#file-diff-view .margin-view-overlays .line-numbers')).filter(n => /^\\d+$/.test(n.textContent)).map(n => {
      const range = document.createRange(); range.selectNodeContents(n);
      const box = n.getBoundingClientRect(), text = range.getBoundingClientRect(), css = getComputedStyle(n);
      const side = n.closest('.editor'), sideBox = side.getBoundingClientRect();
      return {number: Number(n.textContent), width: box.width, boxLeft: box.left, boxRight: box.right,
        textLeft: text.left, textRight: text.right, sideLeft: sideBox.left, sideRight: sideBox.right,
        original: side.classList.contains('original'), align: css.textAlign};
    })`);
  }
  async function checkNumbers() {
    const entries = await numbers();
    assert.ok(entries.some(n => n.original) && entries.some(n => !n.original));
    for (const n of entries) {
      assert.equal(n.align, "right");
      assert.ok(Math.abs(n.textRight - n.boxRight) <= 1, `right aligned: ${JSON.stringify(n)}`);
      assert.ok(n.textLeft >= n.boxLeft - 1 && n.textRight <= n.sideRight + 1, `unclipped: ${JSON.stringify(n)}`);
    }
    return entries;
  }
  async function checkBorder() {
    assert.equal(await q(`(() => {
      const pane = document.querySelector('#file-diff-view').getBoundingClientRect();
      const tab = document.querySelector('.tab.active').getBoundingClientRect();
      return Boolean(document.elementFromPoint((tab.left + tab.right) / 2, pane.top + .25)?.closest('.tab.active'));
    })()`), true, "active tab covers the editor's top border");
  }
  async function capture(name) {
    await q("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await delay(150);
    fs.writeFileSync(path.join(profile,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  fs.writeFileSync(file, lines(1100), "utf8");
  win.webContents.send("open-file", file);
  await until(() => q('document.querySelector(".tab.active .tab-name-label").textContent === "line-numbers.txt"'), "layout file open");
  await type(win, "LOCAL ");
  await menu(win);
  await until(() => q('!document.querySelector("[data-action=diffView]").disabled'), "comparison available");
  await q('document.querySelector("[data-action=diffView]").click()');
  win.setSize(700,750);
  await until(() => q('document.querySelector("#file-diff-view")?.hidden === false'), "comparison visible");
  await key("End");
  await until(() => q('Array.from(document.querySelectorAll("#file-diff-view .modified .line-numbers")).some(n => n.textContent === "1100")'), "four digit numbers visible");
  assert.equal(await q('getComputedStyle(document.querySelector("#file-diff-view .line-numbers")).fontFamily.includes("Consolas")'),true,"keep the normal line-number font");
  await checkNumbers(); await checkBorder(); await capture("diff-inline-four-digits.png");
  await key("Home");
  await until(async () => (await numbers()).some(n => n.number === 1), "short numbers visible");
  await checkNumbers();
  for (const width of [1400, 700]) {
    win.setSize(width, 800);
    await until(() => q(`document.querySelector('#file-diff-view .monaco-diff-editor').classList.contains('side-by-side') === ${width === 1400}`), "comparison layout changed");
    let previousWidth = 0;
    for (const count of [9, 100, 10000]) {
      fs.writeFileSync(file, lines(count), "utf8");
      await menu(win);
      await q('document.querySelector("#tab-context-menu").style.display = "none"');
      await until(async () => {
        const entries = await numbers(), left = entries.find(n => n.original), right = entries.find(n => !n.original);
        return left && right && (count === 9 ? left.width < right.width : left.width > previousWidth);
      }, `gutter sized for ${count} lines`);
      const entries = await checkNumbers(), left = entries.find(n => n.original);
      assert.ok(left.width > previousWidth, "gutter expands as the line count grows");
      previousWidth = left.width;
      await checkBorder();
    }
    await capture(width === 1400 ? "diff-split-growing-gutter.png" : "diff-inline-growing-gutter.png");
  }
  console.log("PASS right-aligned line numbers, automatic gutter growth, unclipped inline columns and active-tab border overlap");
};
