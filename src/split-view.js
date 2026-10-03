// Window layout contains tab IDs and physical pane ratios; models and Undo belong to the tabs.
const SPLIT_SIDES = new Set(["left", "right", "top", "bottom"]);
const OPPOSITE_SIDE = { left: "right", right: "left", top: "bottom", bottom: "top" };
const idOf = tab => tab.sessionTabId || tab.id;

function normalizeSplitLayout(layout, tabs, activeTabId, history = []) {
  const ratios = layout?.ratios ? { ratios: Object.fromEntries(["left", "top"].map(axis => {
    const value = layout.ratios[axis];
    return [axis, Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5];
  })) } : {};
  const available = tabs.filter(tab => !tab._closing);
  const ids = new Set(available.map(idOf));
  const candidate = excluded => [...history, activeTabId, ...available.map(idOf)].find(id =>
    id && id !== excluded && ids.has(id) && !available.find(tab => idOf(tab) === id)?._transferring);
  const split = SPLIT_SIDES.has(layout?.split?.side) && ids.has(layout.split.tabId)
    ? { tabId: layout.split.tabId, side: layout.split.side } : null;
  let primaryTabId = ids.has(layout?.primaryTabId) ? layout.primaryTabId : null;
  if (split && (!primaryTabId || primaryTabId === split.tabId)) primaryTabId = candidate(split.tabId);
  if (!split || !primaryTabId) {
    primaryTabId = ids.has(activeTabId) ? activeTabId : primaryTabId || candidate(null) || available.map(idOf)[0] || null;
    return { ...ratios, primaryTabId, split: null };
  }
  return { ...ratios, primaryTabId, split };
}

function transitionSplitLayout(layout, tabs, activeTabId, history, action) {
  let next = normalizeSplitLayout(layout, tabs, activeTabId, history);
  let active = activeTabId;
  const target = tabs.find(tab => idOf(tab) === action.tabId && !tab._closing);
  if (action.type === "select" && target) {
    active = action.tabId;
    if (next.split?.tabId !== active) next = { ...next, primaryTabId: active };
  } else if (action.type === "split" && target && !target._transferring && SPLIT_SIDES.has(action.side)) {
    // Keep the other visible document when fixing the normal pane. If a hidden
    // tab is fixed opposite the old fixed pane, keep the old fixed document too.
    const primaryTabId = next.split && next.split.tabId !== action.tabId &&
      (next.primaryTabId === action.tabId || OPPOSITE_SIDE[next.split.side] === action.side)
      ? next.split.tabId : next.primaryTabId;
    const proposed = normalizeSplitLayout({ ...next, primaryTabId, split: { tabId: action.tabId, side: action.side } }, tabs, active, history);
    if (proposed.split) { next = proposed; active = action.tabId; }
  } else if (action.type === "unsplit") {
    next = normalizeSplitLayout({ ...next, primaryTabId: active, split: null }, tabs, active, history);
  }
  const visible = [next.primaryTabId, next.split?.tabId];
  if (!visible.includes(active)) active = next.primaryTabId;
  return { layout: next, activeTabId: active };
}

module.exports = { normalizeSplitLayout, transitionSplitLayout };
