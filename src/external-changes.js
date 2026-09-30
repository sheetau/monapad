import { normalize, renderMerge } from "./merge-model.js";

const sameDisk = (a, b) => a && b && a.content === b.content && Boolean(a.hasBom) === Boolean(b.hasBom) && a.isUtf8Valid === b.isUtf8Valid;
const diffOptions = {
  readOnly: true, originalEditable: false, domReadOnly: true, automaticLayout: false,
  // Share the app menu CSS, including the inline diff lightbulb menu.
  useShadowDOM: false,
  renderSideBySide: true, useInlineViewWhenSpaceIsLimited: true, renderSideBySideInlineBreakpoint: 900,
  ignoreTrimWhitespace: false, renderOverviewRuler: true, scrollBeyondLastLine: false,
  occurrencesHighlight: "off", diffWordWrap: "inherit", lineDecorationsWidth: 18,
  padding: { top: 12, bottom: 0 }, stickyScroll: { enabled: false },
  minimap: { enabled: false }, diffCodeLens: false, renderMarginRevertIcon: false,
};

export function createExternalChangesController(api) {
  const { monaco, editor, host, t } = api;
  let active, layoutFrame = null;
  const views = new Map();
  const digitWidths = new Map();
  const pending = new WeakSet();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const canCompare = tab => Boolean(tab?.path && !tab.model.isDisposed() && !tab.isNote && !tab._transferring && !tab._fileSaveInProgress && !tab.isWarned && typeof tab._diskContent === "string" &&
    (normalize(tab.model.getValue()) !== normalize(tab._diskContent) || tab.hasUtf8Bom !== Boolean(tab._diskInfo?.hasBom)));
  function canReload(tab) { return canCompare(tab) && !pending.has(tab); }
  function canMerge(tab) {
    return canReload(tab) && api.isDirty(tab) && typeof tab.mergeBaseContent === "string" &&
      (normalize(tab._diskContent) !== normalize(tab.mergeBaseContent) || Boolean(tab._diskInfo?.hasBom) !== Boolean(tab._lastExternalHasBom)) &&
      tab.isUtf8Valid !== false && tab._diskInfo?.isUtf8Valid !== false;
  }
  function saveView() {
    if (active && !active.pane.hidden) active.tab.diffViewState = active.diff.saveViewState();
  }
  function clearDiffModel(view) {
    view.diff.setModel(null);
    // Cancel comparisons before disposing either text model.
    view.diffViewModel?.dispose(); view.diffViewModel = null;
  }
  function disposeView(view) {
    views.delete(view.tab);
    if (active === view) { saveView(); active = null; }
    clearTimeout(view.resizeTimer);
    view.disposables.forEach(d => d.dispose());
    clearDiffModel(view);
    view.diff.dispose(); view.diskModel.dispose(); view.pane.remove();
  }
  function hideDiff(restoreEditor = true) {
    if (active && !active.pane.hidden) {
      saveView(); clearTimeout(active.resizeTimer); active.pane.hidden = true; active.pane.style.display = "none";
    }
    if (restoreEditor) {
      host.style.visibility = "";
      if (!editor.getOption(monaco.editor.EditorOption.automaticLayout)) editor.updateOptions({ automaticLayout: true });
    }
  }
  function scheduleLayout() {
    if (layoutFrame !== null) return;
    layoutFrame = requestAnimationFrame(() => { layoutFrame = null; layout(false); });
  }
  function lineNumberChars(side) {
    if (!side.getModel()) return 1;
    const font = side.getOption(monaco.editor.EditorOption.fontInfo);
    const key = JSON.stringify([font.fontSize, font.fontWeight, font.letterSpacing]);
    let digitWidth = digitWidths.get(key);
    if (digitWidth === undefined) {
      // The line-number CSS deliberately uses Consolas instead of the text font.
      // Measure that font and reserve enough Monaco character slots for it.
      const probe = element("span", "line-numbers", "0123456789");
      Object.assign(probe.style, { position: "absolute", visibility: "hidden", width: "max-content",
        fontSize: font.fontSize + "px", fontWeight: font.fontWeight,
        letterSpacing: font.letterSpacing + "px", fontVariantNumeric: "tabular-nums" });
      side.getDomNode().append(probe);
      digitWidth = probe.getBoundingClientRect().width / 10;
      probe.remove(); digitWidths.set(key, digitWidth);
    }
    const digits = String(side.getModel()?.getLineCount() || 1).length;
    return Math.max(1, Math.ceil(Math.ceil(digitWidth * digits) / font.maxDigitWidth));
  }
  function layout(resizeNow = true) {
    if (!active || active.pane.hidden) return;
    const { pane, surface, diff } = active;
    const rect = host.getBoundingClientRect();
    const leftMargin = parseFloat(getComputedStyle(host).getPropertyValue("--editor-line-number-offset")) || 0;
    const geometry = [rect.left - leftMargin, rect.top, rect.width + leftMargin, rect.height].join(",");
    if (active.geometry !== geometry) {
      active.geometry = geometry;
      Object.assign(pane.style, { left: rect.left - leftMargin + "px", top: rect.top + "px",
        width: rect.width + leftMargin + "px", height: rect.height + "px" });
    }
    const dimension = { width: surface.clientWidth, height: surface.clientHeight };
    const size = dimension.width + "," + dimension.height;
    if (active.size !== size) {
      clearTimeout(active.resizeTimer);
      if (resizeNow || !active.size) { active.size = size; diff.layout(dimension); }
      else {
        // Advanced wrapping measures text in the DOM. Reflow once resizing pauses,
        // instead of blocking every intermediate native resize notification.
        const view = active;
        view.resizeTimer = setTimeout(() => { if (active === view) layout(); }, 80);
      }
    }
    const sideBySide = surface.querySelector(".monaco-diff-editor").classList.contains("side-by-side");
    for (const [side, original] of [[diff.getOriginalEditor(), true], [diff.getModifiedEditor(), false]]) {
      const desired = { glyphMargin: !original, lineNumbersMinChars: lineNumberChars(side),
        wordWrapOverride2: original && !sideBySide ? "off" : "inherit" };
      const changes = {};
      for (const [name, value] of Object.entries(desired)) {
        if (side.getOption(monaco.editor.EditorOption[name]) !== value) changes[name] = value;
      }
      if (Object.keys(changes).length) side.updateOptions(changes);
    }
  }
  function createView(tab) {
    const pane = element("section", "file-diff-host");
    const surface = element("div", "file-diff-surface");
    pane.append(surface); document.body.append(pane);
    const options = { ...api.editorOptions(tab), ...diffOptions };
    const diff = monaco.editor.createDiffEditor(surface, options);
    const diskModel = monaco.editor.createModel(tab._diskContent ?? "", tab.model.getLanguageId());
    const view = { tab, pane, surface, diff, diskModel, diskContent: tab._diskContent,
      optionsKey: JSON.stringify(options), diffViewModel: null, disposables: [] };
    view.disposables.push(tab.model.onWillDispose(() => disposeView(view)));
    for (const side of [diff.getOriginalEditor(), diff.getModifiedEditor()]) {
      view.disposables.push(side.onDidChangeModelContent(scheduleLayout));
      view.disposables.push(side.onDidChangeConfiguration(event => {
        if (event.hasChanged(monaco.editor.EditorOption.fontInfo)) scheduleLayout();
      }));
    }
    views.set(tab, view);
    return view;
  }
  new ResizeObserver(scheduleLayout).observe(host);
  window.addEventListener("resize", scheduleLayout);
  editor.onDidLayoutChange(scheduleLayout);
  document.fonts.addEventListener("loadingdone", () => { digitWidths.clear(); scheduleLayout(); });
  function sync(tab = api.currentTab()) {
    if (!tab?.isDiffView || !tab.path || tab.isNote || tab.model.isDisposed()) {
      hideDiff();
      return;
    }
    const changedTab = active?.tab !== tab || active.pane.hidden;
    if (changedTab) hideDiff(false);
    const created = !views.has(tab);
    const view = views.get(tab) || createView(tab);
    if (active !== view) {
      if (active) active.pane.removeAttribute("id");
      active = view;
    }
    // Keep at most three comparison editors, including their wrapping and diff
    // results. Normal tab switches don't destroy and recompute the comparison.
    views.delete(tab); views.set(tab, view);
    while (views.size > 3) disposeView(views.values().next().value);
    const { pane, diff, diskModel } = view;
    pane.id = "file-diff-view";
    if (view.diskContent !== tab._diskContent) {
      view.diskContent = tab._diskContent;
      diskModel.setValue(tab._diskContent ?? "");
    }
    let attached = false;
    const readable = !tab.isWarned && typeof tab._diskContent === "string";
    if (!readable && view.diffViewModel) clearDiffModel(view);
    else if (readable && !view.diffViewModel) {
      view.diffViewModel = diff.createViewModel({ original: diskModel, modified: tab.model });
      diff.setModel(view.diffViewModel); attached = true;
    }
    if (diskModel.getLanguageId() !== tab.model.getLanguageId()) monaco.editor.setModelLanguage(diskModel, tab.model.getLanguageId());
    const options = { ...api.editorOptions(tab), ...diffOptions };
    const optionsKey = JSON.stringify(options);
    if (view.optionsKey !== optionsKey) { view.optionsKey = optionsKey; diff.updateOptions(options); }
    pane.title = readable ? "" : t("external.missing");
    pane.hidden = false; pane.style.display = "flex"; host.style.visibility = "hidden";
    if (editor.getOption(monaco.editor.EditorOption.automaticLayout) || !editor.getOption(monaco.editor.EditorOption.readOnly) || editor.getOption(monaco.editor.EditorOption.wordWrap) !== "off") {
      editor.updateOptions({ readOnly: true, automaticLayout: false, wordWrap: "off" });
    }
    layout();
    if ((created || attached) && tab.diffViewState) diff.restoreViewState(tab.diffViewState);
    if (changedTab) diff.getModifiedEditor().focus();
  }
  function observe(tab, info) {
    tab._diskContent = info?.content ?? null;
    tab._diskInfo = info;
    if (api.currentTab() === tab) sync(tab);
  }
  async function refresh(tab) {
    if (!tab?.path || tab.isNote || tab._fileSaveInProgress || tab.model.isDisposed()) return null;
    const filePath = tab.path;
    const saveGeneration = tab._fileSaveGeneration;
    const info = await api.readFile(filePath);
    if (tab.model.isDisposed() || tab.path !== filePath || tab._fileSaveInProgress || tab._fileSaveGeneration !== saveGeneration) return null;
    observe(tab, info);
    return info;
  }
  async function toggle(tab) {
    if (tab?.isDiffView) {
      tab.isDiffView = false;
      if (api.currentTab() === tab) hideDiff();
      if (views.has(tab)) clearDiffModel(views.get(tab));
      if (api.currentTab() === tab) api.switchTab(tab);
      api.changed(); return;
    }
    await refresh(tab);
    if (!canCompare(tab)) return;
    api.switchTab(tab); tab.viewState = editor.saveViewState();
    tab.isDiffView = true; sync(tab); api.changed();
  }
  async function showError(error) {
    console.warn("External change action failed:", error);
    await api.reportError(t("external.failed"), t(`external.${error.message}`, { defaultValue: error.message }));
  }
  function snapshot(tab, disk) {
    return { path: tab.path, disk, base: tab.mergeBaseContent, local: tab.model.getValue(),
      version: tab.model.getVersionId(), eol: tab.model.getEOL(), hasBom: tab.hasUtf8Bom };
  }
  function isCurrent(tab, state, disk) {
    return !tab.model.isDisposed() && !tab._transferring && tab.path === state.path &&
      tab.model.getVersionId() === state.version && tab.hasUtf8Bom === state.hasBom &&
      tab.mergeBaseContent === state.base && sameDisk(state.disk, disk);
  }
  async function protect(tab, state) {
    if (!isCurrent(tab, state, await refresh(tab))) throw new Error("stale");
    await api.checkpoint(tab);
    if (!isCurrent(tab, state, await refresh(tab))) throw new Error("stale");
  }
  async function run(tab, operation) {
    if (!tab || pending.has(tab)) return;
    pending.add(tab); api.changed();
    try { await operation(); }
    finally { pending.delete(tab); api.changed(); }
  }
  async function reload(tab) {
    if (pending.has(tab) || tab?._fileSaveInProgress) return;
    const disk = await refresh(tab);
    if (!disk) throw new Error("missing");
    if (!canReload(tab)) return;
    const state = snapshot(tab, disk);
    await run(tab, async () => {
      await protect(tab, state);
      api.switchTab(tab); api.reload(tab, disk.content, disk);
    });
  }
  function compute(state) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./merge-worker.js", import.meta.url));
      worker.onmessage = ({ data }) => {
        worker.terminate();
        if (data.error) reject(new Error(data.error)); else resolve(data.plan);
      };
      worker.onerror = () => { worker.terminate(); reject(new Error("failed")); };
      worker.postMessage({ base: state.base, local: state.local, disk: state.disk.content });
    });
  }
  async function merge(tab) {
    if (pending.has(tab) || tab?._fileSaveInProgress) return;
    const disk = await refresh(tab);
    if (!disk) throw new Error("missing");
    if (!canMerge(tab)) return;
    const state = snapshot(tab, disk);
    await run(tab, async () => {
      const plan = await compute(state);
      const choices = Object.fromEntries(plan.parts.filter(part => part.id !== undefined).map(part => [part.id, "both"]));
      const result = renderMerge(plan, choices, state.eol).content;
      await protect(tab, state);
      api.switchTab(tab);
      await api.merge(tab, result, disk);
    });
  }
  return { sync, observe, refresh, toggle, merge, reload, canCompare, canReload, canMerge, showError,
    release: tab => { if (views.has(tab)) disposeView(views.get(tab)); },
    saveView,
    focus: () => { if (active && !active.pane.hidden) active.diff.getModifiedEditor().focus(); },
  };
}
