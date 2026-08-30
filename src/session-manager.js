const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SESSION_SCHEMA_VERSION = 1;
const MANIFEST_PREFIX = "manifest-";
const MANIFEST_SUFFIX = ".json";
const SAFE_ID = /^[a-zA-Z0-9_-]{8,100}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : crypto.randomUUID();
}

function normalizeBounds(value) {
  if (!isObject(value)) return null;
  const bounds = {};
  for (const key of ["x", "y", "width", "height"]) {
    if (Number.isFinite(value[key])) bounds[key] = Math.round(value[key]);
  }
  return Number.isFinite(bounds.width) && Number.isFinite(bounds.height) ? bounds : null;
}

function validateManifest(value) {
  if (!isObject(value) || value.schemaVersion !== SESSION_SCHEMA_VERSION) return false;
  if (!Number.isInteger(value.revision) || value.revision < 0 || !Array.isArray(value.windows)) return false;
  return value.windows.every(
    (windowState) =>
      isObject(windowState) &&
      typeof windowState.id === "string" &&
      Array.isArray(windowState.tabs) &&
      windowState.tabs.every((tab) => isObject(tab) && typeof tab.id === "string" && typeof tab.kind === "string"),
  );
}

class SessionManager {
  constructor(rootPath, logger = console) {
    this.rootPath = rootPath;
    this.contentPath = path.join(rootPath, "content");
    this.logger = logger;
    this.state = this.createEmptyState();
    this.writeQueue = Promise.resolve();
  }

  createEmptyState() {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: crypto.randomUUID(),
      revision: 0,
      updatedAt: Date.now(),
      lastActiveWindowId: null,
      windows: [],
    };
  }

  async initialize() {
    await fs.promises.mkdir(this.contentPath, { recursive: true });
    const candidates = await this.readManifestCandidates();
    for (const candidate of candidates) {
      if (await this.isUsableManifest(candidate.value)) {
        this.state = candidate.value;
        return clone(this.state);
      }
    }
    this.state = this.createEmptyState();
    return clone(this.state);
  }

  getState() {
    return clone(this.state);
  }

  hasWindows() {
    return this.state.windows.length > 0;
  }

  getWindowStates() {
    const windows = clone(this.state.windows);
    const activeId = this.state.lastActiveWindowId;
    windows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return { windows, lastActiveWindowId: activeId };
  }

  async hydrateWindow(windowId) {
    const windowState = this.state.windows.find((candidate) => candidate.id === windowId);
    if (!windowState) return null;
    const hydrated = clone(windowState);
    for (const tab of hydrated.tabs) {
      if (!tab.contentRef) {
        if (tab.kind !== "file" || tab.dirty) tab.content = "";
      } else {
        try {
          tab.content = await fs.promises.readFile(this.resolveContentRef(tab.contentRef), "utf8");
        } catch (error) {
          this.logger.warn?.("[session] failed to hydrate tab content:", error.message);
          tab.content = "";
          tab.contentMissing = true;
        }
      }

      if (tab.kind === "file" && tab.path && tab.fileBaselineHash) {
        try {
          const buffer = await fs.promises.readFile(tab.path);
          const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
          let content = buffer.toString("utf8");
          if (content.length > 0 && content.charCodeAt(0) === 0xfeff) content = content.slice(1);
          const currentHash = crypto.createHash("sha256").update(content).digest("hex");
          tab.externalChanged = currentHash !== tab.fileBaselineHash || hasBom !== Boolean(tab.fileBaselineHasBom);
        } catch {
          tab.fileMissing = true;
        }
      }
    }
    return hydrated;
  }

  saveWindow(windowId, payload, windowMeta = {}) {
    return this.enqueueWrite(() => this.doSaveWindow(windowId, payload, windowMeta));
  }

  async doSaveWindow(windowId, payload, windowMeta) {
    if (!isObject(payload) || !Array.isArray(payload.tabs)) {
      throw new Error("Invalid session window payload.");
    }

    const stableWindowId = normalizeId(windowId);
    const next = clone(this.state);
    const existingIndex = next.windows.findIndex((candidate) => candidate.id === stableWindowId);

    if (payload.discardWindow) {
      if (existingIndex !== -1) next.windows.splice(existingIndex, 1);
      if (next.lastActiveWindowId === stableWindowId) {
        next.lastActiveWindowId = next.windows.at(-1)?.id || null;
      }
      await this.commit(next);
      return { success: true, discarded: true };
    }

    const previousWindow = existingIndex === -1 ? null : next.windows[existingIndex];
    const revision = next.revision + 1;
    const tabs = [];
    for (const rawTab of payload.tabs) {
      const tab = await this.normalizeTab(rawTab, revision, previousWindow);
      tabs.push(tab);
    }

    const windowState = {
      id: stableWindowId,
      order: Number.isInteger(payload.order)
        ? payload.order
        : Number.isInteger(previousWindow?.order)
          ? previousWindow.order
          : next.windows.length,
      bounds: normalizeBounds(windowMeta.bounds || payload.bounds),
      maximized: Boolean(windowMeta.maximized ?? payload.maximized),
      activeTabId: typeof payload.activeTabId === "string" ? payload.activeTabId : tabs[0]?.id || null,
      tabs,
      closedAt: payload.closing ? Date.now() : null,
      updatedAt: Date.now(),
    };

    if (existingIndex === -1) next.windows.push(windowState);
    else next.windows[existingIndex] = windowState;
    if (windowMeta.active || !next.lastActiveWindowId) next.lastActiveWindowId = stableWindowId;

    await this.commit(next);
    return { success: true, revision: this.state.revision };
  }

  markWindowActive(windowId) {
    if (!this.state.windows.some((candidate) => candidate.id === windowId)) return Promise.resolve();
    return this.enqueueWrite(async () => {
      if (this.state.lastActiveWindowId === windowId) return;
      const next = clone(this.state);
      next.lastActiveWindowId = windowId;
      await this.commit(next);
    });
  }

  clear() {
    return this.enqueueWrite(async () => {
      let names = [];
      try {
        names = await fs.promises.readdir(this.rootPath);
      } catch {
        // The session directory may not exist yet.
      }
      for (const name of names) {
        if (name.startsWith(MANIFEST_PREFIX) && name.endsWith(MANIFEST_SUFFIX)) {
          await fs.promises.unlink(path.join(this.rootPath, name)).catch(() => {});
        }
      }
      await fs.promises.rm(this.contentPath, { recursive: true, force: true });
      await fs.promises.mkdir(this.contentPath, { recursive: true });
      this.state = this.createEmptyState();
    });
  }

  async normalizeTab(rawTab, revision, previousWindow) {
    if (!isObject(rawTab)) throw new Error("Invalid session tab payload.");
    const id = normalizeId(rawTab.id);
    const previousTab = previousWindow?.tabs?.find((candidate) => candidate.id === id);
    const tab = {
      id,
      kind: ["file", "draft", "note", "pendingNote"].includes(rawTab.kind) ? rawTab.kind : "draft",
      name: typeof rawTab.name === "string" ? rawTab.name : "Untitled.txt",
      path: typeof rawTab.path === "string" ? rawTab.path : null,
      noteId: typeof rawTab.noteId === "string" ? rawTab.noteId : null,
      draftId: typeof rawTab.draftId === "string" ? rawTab.draftId : null,
      pinned: Boolean(rawTab.pinned),
      dirty: Boolean(rawTab.dirty),
      fontSize: Number.isFinite(rawTab.fontSize) ? rawTab.fontSize : null,
      wordWrap: rawTab.wordWrap !== false,
      isMarkdown: Boolean(rawTab.isMarkdown),
      sourceEncoding: typeof rawTab.sourceEncoding === "string" ? rawTab.sourceEncoding : "UTF-8",
      isUtf8Valid: rawTab.isUtf8Valid !== false,
      hasBom: Boolean(rawTab.hasBom),
      viewState: isObject(rawTab.viewState) ? rawTab.viewState : null,
      hasReloadButton: Boolean(rawTab.hasReloadButton),
      isAutoPlaceholder: Boolean(rawTab.isAutoPlaceholder),
    };

    if (tab.kind === "file" && typeof rawTab.originalContent === "string") {
      tab.fileBaselineHash = crypto.createHash("sha256").update(rawTab.originalContent).digest("hex");
      tab.fileBaselineHasBom = Boolean(rawTab.originalHasBom);
    }

    if (Object.prototype.hasOwnProperty.call(rawTab, "content")) {
      const content = typeof rawTab.content === "string" ? rawTab.content : "";
      const contentHash = crypto.createHash("sha256").update(content).digest("hex");
      if (previousTab?.contentHash === contentHash && previousTab.contentRef) {
        tab.contentRef = previousTab.contentRef;
      } else if (content.length > 0) {
        const fileName = `${revision}-${id}-${contentHash.slice(0, 16)}.txt`;
        await this.writeNewFile(path.join(this.contentPath, fileName), content);
        tab.contentRef = `content/${fileName}`;
      } else {
        tab.contentRef = null;
      }
      tab.contentHash = contentHash;
    } else if (tab.kind === "file" && !tab.dirty) {
      tab.contentRef = null;
      tab.contentHash = null;
    } else {
      tab.contentRef = previousTab?.contentRef || null;
      tab.contentHash = previousTab?.contentHash || null;
    }

    return tab;
  }

  async commit(nextState) {
    nextState.revision = this.state.revision + 1;
    nextState.updatedAt = Date.now();
    nextState.schemaVersion = SESSION_SCHEMA_VERSION;
    const fileName = `${MANIFEST_PREFIX}${String(nextState.revision).padStart(12, "0")}-${crypto.randomUUID()}${MANIFEST_SUFFIX}`;
    await this.writeNewFile(path.join(this.rootPath, fileName), JSON.stringify(nextState, null, 2));
    this.state = nextState;
    await this.cleanupOldGenerations();
  }

  enqueueWrite(operation) {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.catch((error) => {
      this.logger.error?.("[session] write failed:", error);
    });
    return result;
  }

  async writeNewFile(targetPath, content) {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, content, "utf8");
      await fs.promises.rename(tempPath, targetPath);
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  async readManifestCandidates() {
    let names = [];
    try {
      names = await fs.promises.readdir(this.rootPath);
    } catch {
      return [];
    }
    const manifests = [];
    for (const name of names.filter((entry) => entry.startsWith(MANIFEST_PREFIX) && entry.endsWith(MANIFEST_SUFFIX))) {
      try {
        const value = JSON.parse(await fs.promises.readFile(path.join(this.rootPath, name), "utf8"));
        if (validateManifest(value)) manifests.push({ name, value });
      } catch {
        // Ignore incomplete or corrupt generations and try the previous one.
      }
    }
    return manifests.sort((a, b) => b.value.revision - a.value.revision);
  }

  async isUsableManifest(manifest) {
    for (const windowState of manifest.windows) {
      for (const tab of windowState.tabs) {
        if (!tab.contentRef) continue;
        try {
          const content = await fs.promises.readFile(this.resolveContentRef(tab.contentRef), "utf8");
          if (tab.contentHash) {
            const contentHash = crypto.createHash("sha256").update(content).digest("hex");
            if (contentHash !== tab.contentHash) return false;
          }
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  resolveContentRef(contentRef) {
    const normalized = String(contentRef || "").replace(/\\/g, "/");
    if (!/^content\/[a-zA-Z0-9_.-]+$/.test(normalized)) throw new Error("Invalid session content reference.");
    return path.join(this.rootPath, ...normalized.split("/"));
  }

  async cleanupOldGenerations() {
    const candidates = await this.readManifestCandidates();
    const usable = [];
    for (const candidate of candidates) {
      if (await this.isUsableManifest(candidate.value)) usable.push(candidate);
    }
    const retained = usable.slice(0, 2);
    const retainedNames = new Set(retained.map((candidate) => candidate.name));
    for (const candidate of candidates) {
      if (!retainedNames.has(candidate.name)) {
        await fs.promises.unlink(path.join(this.rootPath, candidate.name)).catch(() => {});
      }
    }

    const referenced = new Set();
    for (const candidate of retained) {
      for (const windowState of candidate.value.windows) {
        for (const tab of windowState.tabs) {
          if (tab.contentRef) referenced.add(path.basename(tab.contentRef));
        }
      }
    }

    let contentFiles = [];
    try {
      contentFiles = await fs.promises.readdir(this.contentPath);
    } catch {
      return;
    }
    for (const name of contentFiles) {
      if (!referenced.has(name)) await fs.promises.unlink(path.join(this.contentPath, name)).catch(() => {});
    }
  }
}

module.exports = { SESSION_SCHEMA_VERSION, SessionManager, validateManifest };
