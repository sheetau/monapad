import { normalize, renderMerge } from "./merge-model.js";
import { installViewportWrapping } from "./viewport-wrapping.js";

const sameDisk = (a, b) => a && b && a.content === b.content && Boolean(a.hasBom) === Boolean(b.hasBom) && a.isUtf8Valid === b.isUtf8Valid;
const diffOptions = {
  readOnly: true, originalEditable: false, domReadOnly: true, automaticLayout: false,
  // Share the app menu CSS, including the inline diff lightbulb menu.
  useShadowDOM: false,
  renderSideBySide: true, useInlineViewWhenSpaceIsLimited: true, renderSideBySideInlineBreakpoint: 900,
  ignoreTrimWhitespace: false, renderOverviewRuler: true, scrollBeyondLastLine: false,
  occurrencesHighlight: "off", diffWordWrap: "inherit", lineNumbersMinChars: 1, lineDecorationsWidth: 26,
  padding: { top: 12, bottom: 0 }, stickyScroll: { enabled: false },
  minimap: { enabled: false }, diffCodeLens: false, renderMarginRevertIcon: false,
};

export function createExternalChangesController(api) {
  const { monaco, t } = api;
  let syncing = false;
  const views = new Map();
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
  function saveView(view) {
    for (const item of view ? [view] : views.values()) {
      if (!item.pane.hidden && !item.restoring) item.tab.diffViewState = item.diff.saveViewState();
    }
  }
  function clearDiffModel(view) {
    view.diff.setModel(null);
    view.diffViewModel?.dispose(); view.diffViewModel = null;
  }
  function disposeView(view) {
    saveView(view);
    views.delete(view.tab);
    view.disposables.forEach(d => d.dispose());
    clearDiffModel(view);
    view.diff.dispose(); view.diskModel.dispose(); view.pane.remove();
  }
  function optionsFor(tab) {
    return { ...api.editorOptions(tab), ...diffOptions, renderSideBySide: !api.split() };
  }
  function layoutView(view, render = false) {
    if (view.pane.hidden) return;
    const { surface, diff } = view;
    // The hidden original editor switches wrapping mode during inline layout.
    // Preserve a document position, not the shared pixel scroll offset.
    let resizeState = null;
    const dimension = { width: surface.clientWidth, height: surface.clientHeight };
    const size = `${dimension.width},${dimension.height}`;
    if (view.size !== size) {
      resizeState = diff.getModifiedEditor().saveViewState();
      view.size = size;
      diff.layout(dimension);
      render = true;
    }
    const sideBySide = surface.querySelector(".monaco-diff-editor")?.classList.contains("side-by-side");
    for (const [side, original] of [[diff.getOriginalEditor(), true], [diff.getModifiedEditor(), false]]) {
      const desired = { glyphMargin: !original, wordWrapOverride2: original && !sideBySide ? "off" : "inherit" };
      const changes = {};
      for (const [key, value] of Object.entries(desired)) {
        if (side.getOption(monaco.editor.EditorOption[key]) !== value) changes[key] = value;
      }
      if (Object.keys(changes).length) { side.updateOptions(changes); render = true; }
    }
    if (resizeState) diff.getModifiedEditor().restoreViewState(resizeState);
    if (render) {
      diff.getOriginalEditor().render(true);
      diff.getModifiedEditor().render(true);
    }
    if (!sideBySide && view.focusedEditor === diff.getOriginalEditor()) {
      const focused = view.focusedEditor.hasWidgetFocus();
      view.focusedEditor = diff.getModifiedEditor();
      if (api.currentTab() === view.tab) {
        api.activate(view.tab, view.focusedEditor);
        if (focused) view.focusedEditor.focus();
      }
    }
  }
  function layout() { for (const view of views.values()) layoutView(view); }
  function createView(tab, parent) {
    const pane = element("section", "file-diff-host");
    const surface = element("div", "file-diff-surface");
    pane.append(surface); parent.append(pane);
    const options = optionsFor(tab);
    const diff = monaco.editor.createDiffEditor(surface, options);
    const diskModel = monaco.editor.createModel(tab._diskContent ?? "", tab.model.getLanguageId());
    const view = { tab, pane, surface, diff, diskModel, diskContent: tab._diskContent,
      optionsKey: JSON.stringify(options), diffViewModel: null, disposables: [], restoring: false };
    view.disposables.push(tab.model.onWillDispose(() => disposeView(view)));
    for (const ed of [diff.getOriginalEditor(), diff.getModifiedEditor()]) {
      view.disposables.push(installViewportWrapping(ed));
      view.disposables.push(ed.onDidFocusEditorWidget(() => {
        if (!syncing && !pane.hidden) { view.focusedEditor = ed; api.activate(tab, ed); }
      }));
      view.disposables.push(ed.onDidChangeCursorSelection(() => {
        if (!syncing && !pane.hidden && api.currentTab() === tab) api.selectionChanged();
      }));
      view.disposables.push(ed.onDidScrollChange(() => {
        if (!syncing && !pane.hidden && !view.restoring) api.viewChanged();
      }));
    }
    views.set(tab, view);
    return view;
  }
  function activeChanged() {
    const active = views.get(api.currentTab());
    if (!active || active.pane.hidden) return;
    for (const view of views.values()) view.pane.removeAttribute("id");
    active.pane.id = "file-diff-view";
  }
  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      const visiblePanes = api.panes().filter(p => p.tab?.isDiffView && p.tab.path && !p.tab.model.isDisposed());
      const visibleTabs = new Set(visiblePanes.map(p => p.tab));
      for (const view of views.values()) {
        if (!visibleTabs.has(view.tab) && !view.pane.hidden) {
          saveView(view); view.pane.hidden = true;
        }
      }
      for (const parent of visiblePanes) {
        const tab = parent.tab;
        const created = !views.has(tab);
        const view = views.get(tab) || createView(tab, parent.element);
        const showing = created || view.pane.hidden || view.pane.parentElement !== parent.element;
        // Take the saved snapshot before attaching or resizing hidden editors.
        const state = showing ? tab.diffViewState : null;
        if (showing) view.restoring = Boolean(state);
        if (view.pane.parentElement !== parent.element) parent.element.append(view.pane);
        view.pane.hidden = false;
        views.delete(tab); views.set(tab, view);
        const { diff, diskModel } = view;
        if (view.diskContent !== tab._diskContent) {
          view.diskContent = tab._diskContent; diskModel.setValue(tab._diskContent ?? "");
        }
        let attached = false;
        const readable = !tab.isWarned && typeof tab._diskContent === "string";
        if (!readable && view.diffViewModel) clearDiffModel(view);
        else if (readable && !view.diffViewModel) {
          view.diffViewModel = diff.createViewModel({ original: diskModel, modified: tab.model });
          diff.setModel(view.diffViewModel); attached = true;
        }
        if (diskModel.getLanguageId() !== tab.model.getLanguageId()) monaco.editor.setModelLanguage(diskModel, tab.model.getLanguageId());
        const options = optionsFor(tab), key = JSON.stringify(options);
        const optionsChanged = view.optionsKey !== key;
        if (optionsChanged) { view.optionsKey = key; diff.updateOptions(options); }
        view.pane.title = readable ? "" : t("external.missing");
        layoutView(view, showing || attached || optionsChanged);
        if (state) {
          diff.restoreViewState(state);
          diff.getOriginalEditor().render(true); diff.getModifiedEditor().render(true);
          // A new comparison installs view zones after the worker finishes.
          // Restore once those zones exist; never use a timeout as a scroll fix.
          if (attached) {
            const vm = view.diffViewModel;
            vm.waitForDiff().then(() => {
              if (views.get(tab) !== view || view.diffViewModel !== vm || view.pane.hidden || !view.restoring) return;
              diff.restoreViewState(state); view.restoring = false;
            }).catch(() => { view.restoring = false; });
          } else view.restoring = false;
        } else if (showing) view.restoring = false;
      }
      while (views.size > 3) {
        const victim = [...views.values()].find(view => !visibleTabs.has(view.tab));
        if (!victim) break;
        disposeView(victim);
      }
      activeChanged();
    } finally { syncing = false; }
  }
  function editorFor(tab) {
    const view = views.get(tab);
    if (!view || view.pane.hidden) return null;
    const sideBySide = view.surface.querySelector('.monaco-diff-editor')?.classList.contains('side-by-side');
    return sideBySide && view.focusedEditor ? view.focusedEditor : view.diff.getModifiedEditor();
  }
  function observe(tab, info) {
    tab._diskContent = info?.content ?? null;
    tab._diskInfo = info;
    if (api.panes().some(p => p.tab === tab)) sync();
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
      saveView(views.get(tab));
      tab.isDiffView = false;
      api.reconcile();
      if (views.has(tab)) clearDiffModel(views.get(tab));
      api.switchTab(tab); api.changed(); return;
    }
    await refresh(tab);
    if (!canCompare(tab)) return;
    api.switchTab(tab);
    const parent = api.panes().find(p => p.tab === tab);
    tab.viewState = parent.editor.saveViewState();
    tab.isDiffView = true;
    api.reconcile(); api.switchTab(tab); api.changed();
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
    saveView, layout, editorFor, activeChanged,
    tabForEditor: ed => [...views.values()].find(v => v.diff.getOriginalEditor() === ed || v.diff.getModifiedEditor() === ed)?.tab,
    focus: () => editorFor(api.currentTab())?.focus(),
  };
}
