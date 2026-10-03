import { createSplitResizer } from "./split-resizer.js";

// Physical panes are independent of the active command target.
export function createEditorPanes(api) {
  const panes = [];
  let applying = false, frame = null;
  function create(name, host) {
    const element = host.parentElement;
    const pane = { name, element, host, editor: name === "primary" ? api.editor : api.createEditor(host), tab: null, size: "", optionsKey: "" };
    element.dataset.pane = name;
    panes.push(pane);
    api.install(pane.editor, pane);
    pane.editor.onDidFocusEditorWidget(() => {
      if (!applying && pane.tab) api.activate(pane.tab, pane.editor);
    });
    pane.editor.onDidChangeCursorSelection(() => {
      if (!applying && pane.tab) api.selectionChanged(pane);
    });
    pane.editor.onDidScrollChange(() => { if (!applying && pane.tab) api.viewChanged(pane); });
    observer.observe(element);
    return pane;
  }
  const observer = new ResizeObserver(() => scheduleLayout());
  function ensureSecondary() {
    if (panes[1]) return panes[1];
    const element = document.createElement("section");
    element.className = "editor-pane";
    const host = document.createElement("div");
    host.className = "editor-surface";
    host.id = "split-editor";
    element.append(host);
    api.root.append(element);
    return create("split", host);
  }
  function save(pane) {
    if (pane.tab?.model && !pane.tab.model.isDisposed() && pane.editor.getModel() === pane.tab.model && !pane.tab.isDiffView) {
      pane.tab.viewState = pane.editor.saveViewState();
    }
  }
  function layout() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    resizer.layout();
    for (const pane of panes) {
      if (pane.element.hidden) continue;
      const width = pane.host.clientWidth, height = pane.host.clientHeight;
      const size = `${width},${height}`;
      if (size === pane.size) continue;
      pane.size = size;
      if (pane.editor.getModel()) {
        pane.editor.updateOptions({ padding: { top: 12, bottom: height / 2 } });
        pane.editor.layout({ width, height });
        pane.editor.render(true);
      }
    }
    api.layoutDiff?.();
  }
  function scheduleLayout() {
    if (frame === null) frame = requestAnimationFrame(layout);
  }
  function options(pane) {
    if (!pane.tab) return;
    const value = api.options(pane.tab);
    const key = JSON.stringify(value);
    if (key !== pane.optionsKey) {
      pane.optionsKey = key;
      pane.editor.updateOptions(value);
      pane.editor.render(true);
    }
  }
  function apply(state, tabs) {
    applying = true;
    try {
      if (state.split) ensureSecondary();
      const ids = [state.primaryTabId, state.split?.tabId];
      const changes = panes.map((pane, i) => ({ pane, tab: tabs.find(tab => tab.sessionTabId === ids[i]) || null }));
      // Save both sides before any model is detached or moved to the other side.
      for (const { pane, tab } of changes) if (pane.tab !== tab) save(pane);
      for (const { pane, tab } of changes) {
        const model = tab && !tab.isDiffView ? tab.model : null;
        if (pane.editor.getModel() !== model) pane.editor.setModel(null);
      }
      api.root.dataset.split = state.split?.side || "";
      for (const { pane, tab } of changes) {
        const model = tab && !tab.isDiffView ? tab.model : null;
        const changed = pane.tab !== tab || pane.editor.getModel() !== model;
        pane.tab = tab;
        pane.element.hidden = !tab;
        pane.element.dataset.tabId = tab?.sessionTabId || "";
        pane.element.classList.toggle("showing-diff", Boolean(tab?.isDiffView));
        options(pane);
        if (model && pane.editor.getModel() !== model) pane.editor.setModel(model);
        if (changed && model) {
          pane.size = "";
          layout();
          if (tab.viewState) pane.editor.restoreViewState(tab.viewState);
        }
      }
      layout();
    } finally { applying = false; }
  }
  const resizer = createSplitResizer({ root: api.root, ratios: api.ratios, change: api.resize,
    commit: api.resizeEnd, label: api.resizeLabel, schedule: scheduleLayout });
  observer.observe(api.root);
  create("primary", api.host);
  return { panes, apply, saveAll: () => panes.forEach(save), save,
    find: tab => panes.find(pane => pane.tab === tab),
    layout: scheduleLayout, layoutNow: layout,
    updateOptions: () => panes.forEach(options),
    get applying() { return applying; },
    get resizing() { return resizer.dragging; },
  };
}
