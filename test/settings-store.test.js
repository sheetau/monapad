const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createAppSettingsStore } = require("../src/settings-store");

class Store {
  static default = class { constructor() { throw new Error("Wrong inherited constructor"); } };
  constructor({ cwd }) {
    this.path = path.join(cwd, "config.json");
    this.data = fs.existsSync(this.path) ? JSON.parse(fs.readFileSync(this.path, "utf8")) : {};
  }
  has(key) { return Object.hasOwn(this.data, key); }
  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; fs.writeFileSync(this.path, JSON.stringify(this.data), "utf8"); }
}

test("uses the actual CommonJS constructor and migrates legacy settings only once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-settings-"));
  const legacy = path.join(root, "legacy.json");
  try {
    fs.writeFileSync(legacy, JSON.stringify({ sessionRestoreMode: "one", windowBounds: { width: 900 }, unrelated: true }));
    let store = createAppSettingsStore(Store, root, legacy);
    assert.equal(store.get("sessionRestoreMode"), "one");
    assert.equal(store.get("unrelated"), undefined);
    store.set("sessionRestoreMode", "all");
    fs.writeFileSync(legacy, JSON.stringify({ sessionRestoreMode: "none" }));
    store = createAppSettingsStore(Store, root, legacy);
    assert.equal(store.get("sessionRestoreMode"), "all");
    assert.equal(JSON.parse(fs.readFileSync(legacy, "utf8")).sessionRestoreMode, "none");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("keeps an explicit app-local none and supports the ESM export shape", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-settings-"));
  const legacy = path.join(root, "legacy.json");
  try {
    fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ sessionRestoreMode: "none" }));
    fs.writeFileSync(legacy, JSON.stringify({ sessionRestoreMode: "all" }));
    assert.equal(createAppSettingsStore({ default: Store }, root, legacy).get("sessionRestoreMode"), "none");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("an app-local legacy preference takes precedence over the shared store", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "monapad-settings-"));
  const legacy = path.join(root, "legacy.json");
  try {
    fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ sessionRestoreEnabled: false }));
    fs.writeFileSync(legacy, JSON.stringify({ sessionRestoreMode: "all" }));
    const store = createAppSettingsStore(Store, root, legacy);
    assert.equal(store.get("sessionRestoreMode"), undefined);
    assert.equal(store.get("sessionRestoreEnabled"), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
