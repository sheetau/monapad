const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { SessionManager } = require("../src/session-manager");

async function withManager(run) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "monapad-session-"));
  try {
    const manager = new SessionManager(root, { error() {}, warn() {} });
    await manager.initialize();
    await run(manager, root);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

test("stores windows separately and hydrates tab content", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      activeTabId: "tab_aaaa1",
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: true, content: "alpha" }],
    });
    await manager.saveWindow("window_b1", {
      activeTabId: "tab_bbbb1",
      tabs: [{ id: "tab_bbbb1", kind: "file", name: "B", path: "B.txt", dirty: false }],
    });

    assert.equal(manager.getWindowStates().windows.length, 2);
    assert.equal((await manager.hydrateWindow("window_a1")).tabs[0].content, "alpha");
    assert.equal(Object.hasOwn((await manager.hydrateWindow("window_b1")).tabs[0], "content"), false);
  });
});

test("falls back to the previous complete generation", async () => {
  await withManager(async (manager, root) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: true, content: "first" }],
    });
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: true, content: "second" }],
    });

    const manifests = (await fs.promises.readdir(root)).filter((name) => name.startsWith("manifest-")).sort();
    const newestPath = path.join(root, manifests.at(-1));
    const newest = JSON.parse(await fs.promises.readFile(newestPath, "utf8"));
    await fs.promises.unlink(path.join(root, newest.windows[0].tabs[0].contentRef));

    const restored = new SessionManager(root, { error() {}, warn() {} });
    await restored.initialize();
    assert.equal((await restored.hydrateWindow("window_a1")).tabs[0].content, "first");
  });
});

test("falls back when the newest content blob is corrupt", async () => {
  await withManager(async (manager, root) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: true, content: "first" }],
    });
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: true, content: "second" }],
    });

    const manifests = (await fs.promises.readdir(root)).filter((name) => name.startsWith("manifest-")).sort();
    const newest = JSON.parse(await fs.promises.readFile(path.join(root, manifests.at(-1)), "utf8"));
    await fs.promises.writeFile(path.join(root, newest.windows[0].tabs[0].contentRef), "corrupt", "utf8");

    const restored = new SessionManager(root, { error() {}, warn() {} });
    await restored.initialize();
    assert.equal((await restored.hydrateWindow("window_a1")).tabs[0].content, "first");
  });
});

test("does not retain a corrupt generation as the only fallback", async () => {
  await withManager(async (manager, root) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "first" }],
    });
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "second" }],
    });
    const manifests = (await fs.promises.readdir(root)).filter((name) => name.startsWith("manifest-")).sort();
    const newest = JSON.parse(await fs.promises.readFile(path.join(root, manifests.at(-1)), "utf8"));
    await fs.promises.writeFile(path.join(root, newest.windows[0].tabs[0].contentRef), "corrupt", "utf8");

    const restored = new SessionManager(root, { error() {}, warn() {} });
    await restored.initialize();
    await restored.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "third" }],
    });

    const retained = (await fs.promises.readdir(root)).filter((name) => name.startsWith("manifest-"));
    assert.equal(retained.length, 2);
    const latest = retained
      .map((name) => ({ name, value: JSON.parse(fs.readFileSync(path.join(root, name), "utf8")) }))
      .sort((a, b) => b.value.revision - a.value.revision)[0];
    await fs.promises.writeFile(path.join(root, latest.value.windows[0].tabs[0].contentRef), "corrupt", "utf8");

    const fallback = new SessionManager(root, { error() {}, warn() {} });
    await fallback.initialize();
    assert.equal((await fallback.hydrateWindow("window_a1")).tabs[0].content, "first");
  });
});

test("discarding a placeholder-only window removes it from the session", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", name: "A", dirty: false, content: "" }],
    });
    await manager.saveWindow("window_a1", { discardWindow: true, tabs: [] });
    assert.equal(manager.hasWindows(), false);
  });
});

test("a clean file tab does not retain stale dirty content", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "file", path: "A.txt", dirty: true, content: "dirty" }],
    });
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "file", path: "A.txt", dirty: false }],
    });

    const tab = (await manager.hydrateWindow("window_a1")).tabs[0];
    assert.equal(tab.contentRef, null);
    assert.equal(Object.hasOwn(tab, "content"), false);
  });
});

test("detects file changes that happened while the app was closed", async () => {
  await withManager(async (manager, root) => {
    const filePath = path.join(root, "document.txt");
    await fs.promises.writeFile(filePath, "original", "utf8");
    await manager.saveWindow("window_a1", {
      tabs: [
        {
          id: "tab_aaaa1",
          kind: "file",
          path: filePath,
          dirty: true,
          content: "edited",
          originalContent: "original",
          originalHasBom: false,
        },
      ],
    });

    assert.equal((await manager.hydrateWindow("window_a1")).tabs[0].externalChanged, false);
    await fs.promises.writeFile(filePath, "changed outside", "utf8");
    assert.equal((await manager.hydrateWindow("window_a1")).tabs[0].externalChanged, true);
  });
});
