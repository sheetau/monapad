const assert = require("node:assert/strict");
const test = require("node:test");

const { computeTabPathDescriptions, shortenPaths } = require("../src/tab-labels");

test("shows paths only for same-kind duplicate names with different directories", () => {
  const firstFile = {};
  const secondFile = {};
  const note = {};
  const descriptions = computeTabPathDescriptions([
    { tab: firstFile, kind: "file", name: "index.js", description: "C:\\alpha" },
    { tab: secondFile, kind: "file", name: "index.js", description: "C:\\beta" },
    { tab: note, kind: "note", name: "index.js", description: "notes" },
  ]);

  assert.equal(descriptions.get(firstFile), "C:\\alpha");
  assert.equal(descriptions.get(secondFile), "C:\\beta");
  assert.equal(descriptions.has(note), false);
});

test("uses VS Code-style fixed shortening for duplicate file paths", () => {
  const first = {};
  const second = {};
  const descriptions = computeTabPathDescriptions([
    { tab: first, kind: "file", name: "x", description: "C:\\work\\alpha\\src" },
    { tab: second, kind: "file", name: "x", description: "C:\\work\\beta\\src" },
  ]);

  assert.equal(descriptions.get(first), "C:\\…\\alpha\\…");
  assert.equal(descriptions.get(second), "C:\\…\\beta\\…");
});

test("does not describe same-title notes in the same folder", () => {
  const first = {};
  const second = {};
  const descriptions = computeTabPathDescriptions([
    { tab: first, kind: "note", name: "Meeting", description: "work" },
    { tab: second, kind: "note", name: "Meeting", description: "work" },
  ]);

  assert.equal(descriptions.size, 0);
});

test("keeps shared folder labels when another same-title note is in a different folder", () => {
  const first = {};
  const second = {};
  const third = {};
  const descriptions = computeTabPathDescriptions([
    { tab: first, kind: "note", name: "Meeting", description: "work" },
    { tab: second, kind: "note", name: "Meeting", description: "work" },
    { tab: third, kind: "note", name: "Meeting", description: "personal" },
  ]);

  assert.equal(descriptions.get(first), "work");
  assert.equal(descriptions.get(second), "work");
  assert.equal(descriptions.get(third), "personal");
});

test("distinguishes root and nested notes without including the Notes root", () => {
  const root = {};
  const nested = {};
  const descriptions = computeTabPathDescriptions([
    { tab: root, kind: "note", name: "Meeting", description: "" },
    { tab: nested, kind: "note", name: "Meeting", description: "projects" },
  ]);

  assert.equal(descriptions.has(root), false);
  assert.equal(descriptions.get(nested), "projects");
});

test("keeps complete note paths for CSS overflow handling", () => {
  const first = {};
  const second = {};
  const descriptions = computeTabPathDescriptions([
    { tab: first, kind: "note", name: "Meeting", description: "top\\middle\\leaf" },
    { tab: second, kind: "note", name: "Meeting", description: "other\\leaf" },
  ]);

  assert.equal(descriptions.get(first), "top\\middle\\leaf");
  assert.equal(descriptions.get(second), "other\\leaf");
});

test("preserves drive prefixes while selecting unique file path segments", () => {
  assert.deepEqual(shortenPaths(["C:\\work\\alpha\\src", "C:\\work\\beta\\src"], "\\"), [
    "C:\\…\\alpha\\…",
    "C:\\…\\beta\\…",
  ]);
});

test("always-show mode removes the duplicate-name requirement", () => {
  const file = {};
  const note = {};
  const rootNote = {};
  const descriptions = computeTabPathDescriptions(
    [
      { tab: file, kind: "file", name: "index.js", description: "C:\\work\\src" },
      { tab: note, kind: "note", name: "Meeting", description: "work\\projects" },
      { tab: rootNote, kind: "note", name: "Root", description: "" },
    ],
    "\\",
    true,
  );

  assert.equal(descriptions.get(file), "C:\\…\\src");
  assert.equal(descriptions.get(note), "work\\projects");
  assert.equal(descriptions.has(rootNote), false);
});
