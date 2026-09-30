const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeSplitLayout, transitionSplitLayout } = require("../src/split-view");
const tabs = ["a", "b", "c"].map(id => ({ id }));
const initial = { primaryTabId: "b", split: { tabId: "a", side: "right" } };
const step = (layout, active, action, list = tabs, history = ["b", "a", "c"]) =>
  transitionSplitLayout(layout, list, active, history, action);

test("fixed tab focus never replaces the normal pane; selecting other tabs does", () => {
  const c = step(initial, "b", { type: "select", tabId: "c" });
  const a = step(c.layout, "c", { type: "select", tabId: "a" });
  assert.deepEqual(a, { activeTabId: "a", layout: { primaryTabId: "c", split: initial.split } });
});
test("fixing the normal tab chooses the most recent other tab, hidden replacement keeps normal", () => {
  assert.deepEqual(step(initial, "b", { type: "split", tabId: "b", side: "top" }).layout,
    { primaryTabId: "a", split: { tabId: "b", side: "top" } });
  assert.equal(step(initial, "a", { type: "split", tabId: "c", side: "left" }).layout.primaryTabId, "b");
});
test("all directions retain the same documents and un-splitting keeps the active one", () => {
  for (const side of ["left", "right", "top", "bottom"]) {
    const next = step(initial, "b", { type: "split", tabId: "a", side });
    assert.deepEqual(next.layout, { primaryTabId: "b", split: { tabId: "a", side } });
    assert.deepEqual(step(next.layout, "a", { type: "unsplit" }).layout, { primaryTabId: "a", split: null });
  }
});
test("one tab cannot start a split and transferring tabs are not new candidates", () => {
  assert.equal(step({ primaryTabId: "a" }, "a", { type: "split", tabId: "a", side: "right" }, tabs.slice(0, 1)).layout.split, null);
  const list = tabs.map(t => ({ ...t, _transferring: t.id === "b" }));
  assert.equal(step({ primaryTabId: "a" }, "a", { type: "split", tabId: "a", side: "right" }, list).layout.primaryTabId, "c");
  assert.deepEqual(normalizeSplitLayout(initial, list, "a"), initial, "pending transfers keep their existing placement");
});
test("removing fixed/normal/last-normal tabs yields a valid visible active tab", () => {
  assert.deepEqual(step(initial, "a", { type: "remove" }, tabs.slice(1)), { layout: { primaryTabId: "b", split: null }, activeTabId: "b" });
  assert.deepEqual(step(initial, "b", { type: "remove" }, [tabs[0], tabs[2]]).layout,
    { primaryTabId: "c", split: initial.split });
  assert.deepEqual(step(initial, "b", { type: "remove" }, [tabs[0]]), { layout: { primaryTabId: "a", split: null }, activeTabId: "a" });
});
test("old or corrupt layouts preserve documents and normalize IDs", () => {
  assert.deepEqual(normalizeSplitLayout(null, tabs, "b"), { primaryTabId: "b", split: null });
  assert.deepEqual(normalizeSplitLayout({ primaryTabId: "missing", split: initial.split }, tabs, "a"), initial);
  assert.equal(normalizeSplitLayout({ ...initial, split: { tabId: "a", side: "invalid" } }, tabs, "c").split, null);
  assert.deepEqual(normalizeSplitLayout(initial, [], "a"), { primaryTabId: null, split: null });
});
test("tab order and pin flags have no effect on an established split", () => {
  assert.deepEqual(normalizeSplitLayout(initial, tabs.slice().reverse().map(t => ({ ...t, isPinned: true })), "a"), initial);
});
