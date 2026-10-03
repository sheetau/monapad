import * as monaco from "monaco-editor";
import { installViewportWrapping } from "../src/viewport-wrapping.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function until(predicate, message) {
  const end = performance.now() + 15000;
  while (performance.now() < end) {
    if (predicate()) return;
    await delay(30);
  }
  throw new Error(message);
}
const content = Array.from({ length: 6000 }, (_, i) => `${i}:\t${"折り返し Japanese proportional WWW iii words 😀 é　".repeat(5)}`).join("\n");
const options = { value: content, wordWrap: "on", wrappingStrategy: "advanced", fontFamily: "Arial",
  disableMonospaceOptimizations: true, automaticLayout: false, minimap: { enabled: true },
  stickyScroll: { enabled: false }, scrollBeyondLastLine: false };
function create(optimized) {
  const host = document.createElement("div");
  Object.assign(host.style, { width: "1000px", height: "650px" });
  document.body.append(host);
  const editor = monaco.editor.create(host, options);
  if (optimized) installViewportWrapping(editor);
  return editor;
}
const projection = ed => ed._getViewModel()._lines.modelLineProjections.map(p => p.getProjectionData()?.breakOffsets ?? null);
const signature = ed => JSON.stringify(projection(ed));
function instrument(editor) {
  const factory = editor._getViewModel()._lines._domLineBreaksComputerFactory;
  const original = factory.createLineBreaksComputer;
  const batches = [];
  factory.createLineBreaksComputer = function (...args) {
    const computer = original.apply(this, args);
    let count = 0;
    const add = computer.addRequest, finalize = computer.finalize;
    computer.addRequest = (...request) => { count++; return add(...request); };
    computer.finalize = () => { batches.push(count); return finalize(); };
    return computer;
  };
  return batches;
}
window.runChecks = async () => {
  const baseline = create(false), optimized = create(true);
  const measured = instrument(optimized);
  const widths = [960, 920, 880, 840, 800, 760, 720, 680];
  const liveBatches = [];
  async function burst(editor) {
    const times = [];
    for (const width of widths) {
      await frame();
      const firstBatch = measured.length;
      const start = performance.now();
      editor.layout({ width, height: 650 });
      times.push(performance.now() - start);
      if (editor === optimized) liveBatches.push(...measured.slice(firstBatch));
    }
    return times;
  }
  const baselineMs = await burst(baseline);
  measured.length = 0;
  const optimizedMs = await burst(optimized);
  assert(liveBatches.length > 0 && Math.max(...liveBatches) < 200, "live resizing measured offscreen lines");
  await until(() => signature(optimized) === signature(baseline), "deferred wrap differs from native Monaco");
  assert(Math.max(...measured) < 200, "background measurement is not bounded");
  const backgroundMaxLines = Math.max(...measured);

  // Scrolling into not-yet-measured lines, then editing, must never apply stale
  // line offsets or change text, selection, undo history or folded ranges.
  optimized.setPosition({ lineNumber: 3100, column: 12 });
  optimized.revealLineInCenter(3100); await frame();
  optimized.setHiddenAreas([new monaco.Range(100, 1, 300, 1)]);
  baseline.setHiddenAreas([new monaco.Range(100, 1, 300, 1)]);
  const position = optimized.getPosition();
  optimized.layout({ width: 580, height: 650 });
  const anchor = optimized.getVisibleRanges()[0].startLineNumber;
  baseline.layout({ width: 580, height: 650 });
  await until(() => signature(optimized) === signature(baseline), "middle-of-file refinement did not finish");
  assert(optimized.getVisibleRanges()[0].startLineNumber === anchor, "background completion moved the viewport");
  assert(optimized.getPosition().equals(position), "background completion moved the caret");
  assert(optimized._getViewModel()._lines.getHiddenAreas()[0].startLineNumber === 100, "lost folded region");

  optimized.layout({ width: 740, height: 650 });
  optimized.revealLineInCenter(5000); await frame(); await frame();
  baseline.layout({ width: 740, height: 650 });
  const current = projection(optimized), expected = projection(baseline);
  for (const range of optimized.getVisibleRanges()) {
    for (let line = range.startLineNumber; line <= range.endLineNumber; line++) {
      assert(JSON.stringify(current[line - 1]) === JSON.stringify(expected[line - 1]), "newly visible line has stale wrapping");
    }
  }
  optimized.layout({ width: 620, height: 650 });
  const edit = { range: new monaco.Range(2000, 1, 2001, 1), text: "changed\nextra inserted line\n" };
  optimized.executeEdits("test", [edit]); baseline.executeEdits("test", [edit]);
  baseline.layout({ width: 620, height: 650 });
  await until(() => signature(optimized) === signature(baseline), "edit during resize applied stale measurements");
  optimized.getModel().undo(); baseline.getModel().undo();
  assert(optimized.getValue() === content, "resize damaged undo history");

  optimized.layout({ width: 590, height: 650 });
  const injected = [{ range: new monaco.Range(3500, 4, 3500, 4), options: {
    after: { content: "injected hint ".repeat(12), inlineClassName: "test-hint" },
    showIfCollapsed: true,
  } }];
  const hints = [optimized, baseline].map(ed => ed.createDecorationsCollection(injected));
  baseline.layout({ width: 590, height: 650 });
  await until(() => signature(optimized) === signature(baseline), "injected text applied stale measurements");
  hints.forEach(hint => hint.clear());

  optimized.layout({ width: 540, height: 650 });
  optimized.updateOptions({ fontSize: 18, tabSize: 8 });
  baseline.updateOptions({ fontSize: 18, tabSize: 8 });
  baseline.layout({ width: 540, height: 650 });
  await until(() => signature(optimized) === signature(baseline), "font/tab-size change reused stale measurements");
  optimized.layout({ width: 780, height: 650 });
  optimized.updateOptions({ wordWrap: "off" }); baseline.updateOptions({ wordWrap: "off" });
  await delay(250);
  assert(signature(optimized) === signature(baseline), "wrap-off was overwritten by pending work");
  optimized.updateOptions({ wordWrap: "on" });
  optimized.layout({ width: 600, height: 650 });
  const previous = optimized.getModel(), replacement = monaco.editor.createModel("replacement text");
  optimized.setModel(replacement); previous.dispose();
  await delay(250);
  assert(optimized.getValue() === "replacement text", "model switch was overwritten by pending work");
  optimized.dispose(); baseline.getModel().dispose(); baseline.dispose(); replacement.dispose();
  await checkDiff();
  return { baselineMs, optimizedMs, liveMeasuredLines: liveBatches, backgroundMaxLines };
};

async function checkDiff() {
  const text = content.split("\n").slice(0, 1000).join("\n");
  const createDiff = optimize => {
    const host = document.createElement("div");
    Object.assign(host.style, { width: "1200px", height: "650px" }); document.body.append(host);
    const diff = monaco.editor.createDiffEditor(host, { ...options, value: undefined,
      minimap: { enabled: false }, renderSideBySide: true, renderSideBySideInlineBreakpoint: 900 });
    const models = { original: monaco.editor.createModel(text),
      modified: monaco.editor.createModel(text.replace("420:", "added\n420:").replace("600:", "changed ".repeat(30))) };
    if (optimize) {
      installViewportWrapping(diff.getOriginalEditor()); installViewportWrapping(diff.getModifiedEditor());
    }
    const vm = diff.createViewModel(models); diff.setModel(vm);
    return { diff, models, vm };
  };
  const native = createDiff(false), fast = createDiff(true);
  await Promise.all([native.vm.waitForDiff(), fast.vm.waitForDiff()]);
  const sides = ["getOriginalEditor", "getModifiedEditor"];
  for (const width of [1100, 980, 700, 1050]) {
    for (const item of [native, fast]) {
      for (const side of sides) item.diff[side]().revealLineInCenter(500);
      item.diff.layout({ width, height: 650 });
      // Match the app: inline's hidden original uses no wrapping.
      item.diff.getOriginalEditor().updateOptions({ wordWrapOverride2: width < 900 ? "off" : "inherit" });
    }
    await until(() => sides.every(side => signature(native.diff[side]()) === signature(fast.diff[side]())), "diff wrapping differs from native Monaco");
    await delay(100);
    for (const side of sides) {
      const a = native.diff[side](), b = fast.diff[side]();
      assert(a.getTopForLineNumber(800) === b.getTopForLineNumber(800), "diff view zones lost alignment after wrapping");
    }
  }
  for (const item of [native, fast]) {
    item.diff.setModel(null); item.vm.dispose(); item.diff.dispose();
    item.models.original.dispose(); item.models.modified.dispose();
  }
}
