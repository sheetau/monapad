const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  SessionManager,
  normalizeSessionRestoreMode,
  shouldRetainSessionWindowOnClose,
} = require("../src/session-manager");

async function withManager(run, limits = {}) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "monapad-session-"));
  try {
    const manager = new SessionManager(root, { error() {}, warn() {} }, limits);
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

test("does not persist automatically created empty draft or pending-note windows", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      tabs: [
        {
          id: "tab_aaaa1",
          kind: "draft",
          dirty: false,
          content: "",
          isAutoPlaceholder: true,
        },
      ],
    });
    assert.equal(manager.hasWindows(), false);

    await manager.saveWindow("window_b1", {
      tabs: [
        {
          id: "tab_bbbb1",
          kind: "pendingNote",
          dirty: false,
          content: "",
          isAutoPlaceholder: true,
        },
      ],
    });
    assert.equal(manager.hasWindows(), false);
  });
});

test("keeps an explicitly created empty draft during periodic snapshots", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: false, content: "", isAutoPlaceholder: false }],
    });
    assert.equal(manager.hasWindows(), true);
    assert.equal(manager.getWindowStates().windows[0].tabs[0].isAutoPlaceholder, false);
  });
});

test("closing a legacy empty draft-like window removes it", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "pendingNote", dirty: false, content: "" }],
    });
    assert.equal(manager.hasWindows(), true);

    await manager.saveWindow("window_a1", {
      closing: true,
      tabs: [{ id: "tab_aaaa1", kind: "pendingNote", dirty: false, content: "" }],
    });
    assert.equal(manager.hasWindows(), false);
  });
});

test("removes legacy closed empty-note windows while initializing", async () => {
  await withManager(async (_manager, root) => {
    const legacy = {
      schemaVersion: 1,
      sessionId: "session_legacy1",
      revision: 1,
      updatedAt: Date.now(),
      lastActiveWindowId: "window_a1",
      windows: [
        {
          id: "window_a1",
          order: 0,
          activeTabId: "tab_aaaa1",
          closedAt: Date.now(),
          tabs: [
            {
              id: "tab_aaaa1",
              kind: "pendingNote",
              dirty: false,
              pinned: false,
              contentRef: null,
              isAutoPlaceholder: false,
            },
          ],
        },
      ],
    };
    await fs.promises.writeFile(
      path.join(root, "manifest-000000000001-legacy.json"),
      JSON.stringify(legacy),
      "utf8",
    );

    const restored = new SessionManager(root, { error() {}, warn() {} });
    await restored.initialize();
    assert.equal(restored.hasWindows(), false);
    assert.equal(restored.getState().lastActiveWindowId, null);
  });
});

test("filters an automatic placeholder without disturbing meaningful tab order", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow("window_a1", {
      activeTabId: "tab_aaaa1",
      tabs: [
        { id: "tab_aaaa1", kind: "draft", dirty: false, content: "", isAutoPlaceholder: true },
        { id: "tab_bbbb1", kind: "draft", dirty: true, content: "kept" },
        { id: "tab_cccc1", kind: "file", path: "C.txt", dirty: false },
      ],
    });

    const snapshot = await manager.hydrateWindow("window_a1");
    assert.deepEqual(
      snapshot.tabs.map((tab) => tab.id),
      ["tab_bbbb1", "tab_cccc1"],
    );
    assert.equal(snapshot.activeTabId, "tab_bbbb1");
  });
});

test("selects all, one, or no windows according to the restore mode", async () => {
  await withManager(async (manager) => {
    await manager.saveWindow(
      "window_a1",
      { tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "A" }] },
      { active: true },
    );
    await manager.saveWindow(
      "window_b1",
      { tabs: [{ id: "tab_bbbb1", kind: "draft", dirty: true, content: "B" }] },
      { active: true },
    );
    await manager.markWindowActive("window_a1");

    assert.deepEqual(
      manager.getWindowStates("all").windows.map((windowState) => windowState.id),
      ["window_a1", "window_b1"],
    );
    assert.deepEqual(
      manager.getWindowStates("one").windows.map((windowState) => windowState.id),
      ["window_a1"],
    );
    assert.deepEqual(manager.getWindowStates("none").windows, []);
  });
});

test("pruning to one restored window prevents stale windows from returning", async () => {
  await withManager(async (manager, root) => {
    await manager.saveWindow("window_a1", {
      tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "A" }],
    });
    await manager.saveWindow("window_b1", {
      tabs: [{ id: "tab_bbbb1", kind: "draft", dirty: true, content: "B" }],
    });
    await manager.retainWindows(["window_b1"]);

    const manifests = (await fs.promises.readdir(root)).filter((name) => name.startsWith("manifest-")).sort();
    await fs.promises.writeFile(path.join(root, manifests.at(-1)), "corrupt", "utf8");

    const restored = new SessionManager(root, { error() {}, warn() {} });
    await restored.initialize();
    assert.deepEqual(
      restored.getWindowStates("all").windows.map((windowState) => windowState.id),
      ["window_b1"],
    );
    assert.equal(await restored.hydrateWindow("window_a1"), null);
  });
});

test("manual secondary closes are discarded while the last pending close is retained", () => {
  const windowIds = [1, 2, 3];
  assert.equal(
    shouldRetainSessionWindowOnClose({ windowIds, pendingWindowIds: [], windowId: 1 }),
    false,
  );
  assert.equal(
    shouldRetainSessionWindowOnClose({ windowIds, pendingWindowIds: [1, 2], windowId: 3 }),
    true,
  );
  assert.equal(
    shouldRetainSessionWindowOnClose({
      windowIds,
      pendingWindowIds: [],
      windowId: 1,
      quitRequested: true,
    }),
    true,
  );
});

test("normalizes current and legacy restore settings", () => {
  assert.equal(normalizeSessionRestoreMode("all"), "all");
  assert.equal(normalizeSessionRestoreMode("one"), "one");
  assert.equal(normalizeSessionRestoreMode("none"), "none");
  assert.equal(normalizeSessionRestoreMode(undefined, true), "all");
  assert.equal(normalizeSessionRestoreMode(undefined, false), "none");
  assert.equal(normalizeSessionRestoreMode("invalid", true), "all");
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

test("rejects oversized session content without replacing the last valid snapshot", async () => {
  await withManager(
    async (manager) => {
      await manager.saveWindow("window_a1", {
        tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "12345" }],
      });

      await assert.rejects(
        manager.saveWindow("window_a1", {
          tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "123456" }],
        }),
        { code: "RECOVERY_ITEM_TOO_LARGE" },
      );
      assert.equal((await manager.hydrateWindow("window_a1")).tabs[0].content, "12345");
    },
    { maxItemBytes: 5, maxTotalBytes: 20 },
  );
});

test("enforces the session total across windows without deleting valid windows", async () => {
  await withManager(
    async (manager) => {
      await manager.saveWindow("window_a1", {
        tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "1234" }],
      });
      await manager.saveWindow("window_b1", {
        tabs: [{ id: "tab_bbbb1", kind: "draft", dirty: true, content: "5678" }],
      });

      await assert.rejects(
        manager.saveWindow("window_c1", {
          tabs: [{ id: "tab_cccc1", kind: "draft", dirty: true, content: "9" }],
        }),
        { code: "RECOVERY_STORAGE_FULL" },
      );
      assert.deepEqual(
        manager.getWindowStates().windows.map((windowState) => windowState.id),
        ["window_a1", "window_b1"],
      );
    },
    { maxItemBytes: 8, maxTotalBytes: 8 },
  );
});

test("session limits count UTF-8 bytes instead of JavaScript characters", async () => {
  await withManager(
    async (manager) => {
      await manager.saveWindow("window_a1", {
        tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "あ" }],
      });
      await assert.rejects(
        manager.saveWindow("window_a1", {
          tabs: [{ id: "tab_aaaa1", kind: "draft", dirty: true, content: "あい" }],
        }),
        { code: "RECOVERY_ITEM_TOO_LARGE" },
      );
    },
    { maxItemBytes: 3, maxTotalBytes: 20 },
  );
});
