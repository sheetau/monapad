// Window layout contains IDs only; models and Undo belong to the tabs.
const SPLIT_SIDES = new Set(["left", "right", "top", "bottom"]);
const idOf = tab => tab.sessionTabId || tab.id;

function normalizeSplitLayout(layout, tabs, activeTabId, history = []) {
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
    return { primaryTabId, split: null };
  }
  return { primaryTabId, split };
}

function transitionSplitLayout(layout, tabs, activeTabId, history, action) {
  let next = normalizeSplitLayout(layout, tabs, activeTabId, history);
  let active = activeTabId;
  const target = tabs.find(tab => idOf(tab) === action.tabId && !tab._closing);
  if (action.type === "select" && target) {
    active = action.tabId;
    if (next.split?.tabId !== active) next = { ...next, primaryTabId: active };
  } else if (action.type === "split" && target && !target._transferring && SPLIT_SIDES.has(action.side)) {
    const proposed = normalizeSplitLayout({ ...next, split: { tabId: action.tabId, side: action.side } }, tabs, active, history);
    if (proposed.split) { next = proposed; active = action.tabId; }
  } else if (action.type === "unsplit") {
    next = normalizeSplitLayout({ primaryTabId: active, split: null }, tabs, active, history);
  }
  const visible = [next.primaryTabId, next.split?.tabId];
  if (!visible.includes(active)) active = next.primaryTabId;
  return { layout: next, activeTabId: active };
}

module.exports = { normalizeSplitLayout, transitionSplitLayout };
