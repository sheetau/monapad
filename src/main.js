const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const { getFonts } = require("font-list");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const { TextDecoder } = require("util");
const Store = require("electron-store").default;
const log = require("electron-log");
const logDir = path.dirname(log.transports.file.getFile().path);
const kuromoji = require("kuromoji");

const store = new Store();
const watchers = new Map();
const watcherRefCounts = new Map();
const watchTimeouts = new Map();
const watchEvents = new Map();
const watchedCssFiles = new Map();
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let filePathToOpen = null;
let cursorWindow = null;
let lastCursorWindowBounds = null;
let kuromojiTokenizer = null;
let kuromojiInitPromise = null;
let mobileShareServer = null;
let mobileShareHost = null;
let mobileSharePort = null;
let mobileShareStartPromise = null;
let autosaveDraftRecoveryClaimed = false;

const WINDOW_CONTROL_OVERLAY = {
  height: 36,
  color: "#000000",
  symbolColor: "#565b66",
};

function normalizeOverlayColor(value, fallback) {
  const color = String(value || "").trim();
  if (/^#[\da-f]{3}$/i.test(color) || /^#[\da-f]{6}$/i.test(color)) return color;
  return fallback;
}

function setWindowTitleBarOverlay(window, options = {}) {
  if (!window || window.isDestroyed() || typeof window.setTitleBarOverlay !== "function") return;
  window.setTitleBarOverlay({
    height: WINDOW_CONTROL_OVERLAY.height,
    color: normalizeOverlayColor(options.color, WINDOW_CONTROL_OVERLAY.color),
    symbolColor: normalizeOverlayColor(options.symbolColor, WINDOW_CONTROL_OVERLAY.symbolColor),
  });
}

const mobileShareItems = new Map();
const MOBILE_SHARE_CREATED_TTL_MS = 5 * 60 * 1000;
const MOBILE_SHARE_OPENED_TTL_MS = 2 * 60 * 1000;
const MOBILE_SHARE_MAX_TEXT_BYTES = 2 * 1024 * 1024;
const AUTOSAVE_MAX_ITEM_BYTES = 5 * 1024 * 1024;
const AUTOSAVE_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

function sendWindowMaximizeState(window) {
  if (!window || window.webContents.isDestroyed()) return;
  window.webContents.send("window-maximize-state", window.isMaximized());
}

function bindWindowMaximizeState(window) {
  window.on("maximize", () => sendWindowMaximizeState(window));
  window.on("unmaximize", () => sendWindowMaximizeState(window));
  window.on("enter-full-screen", () => sendWindowMaximizeState(window));
  window.on("leave-full-screen", () => sendWindowMaximizeState(window));
}

fs.readdirSync(logDir).forEach((file) => {
  if (file.startsWith("main.log.old")) {
    const filePath = path.join(logDir, file);
    fs.unlinkSync(filePath);
    console.log(`[LOG CLEANUP] Deleted old log file: ${file}`);
  }
});

function createWindow() {
  const windowBounds = store.get("windowBounds") || { width: 800, height: 600 };

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 400,
    minHeight: 210,
    backgroundColor: "#000000",
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: WINDOW_CONTROL_OVERLAY,
    // transparent: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, "icon/favicon.ico"),
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  bindWindowMaximizeState(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("focus", () => {
    mainWindow.webContents.send("window-focus", true);
  });

  mainWindow.on("blur", () => {
    mainWindow.webContents.send("window-focus", false);
  });

  mainWindow.on("resize", () => {
    const { width, height } = mainWindow.getBounds();
    store.set("windowBounds", { width, height });
  });

  mainWindow.on("close", (e) => {
    if (mainWindow.webContents.isDestroyed()) return;
    e.preventDefault();
    mainWindow.webContents.send("attempt-close-window");
  });

  // open link with default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentURL = mainWindow.webContents.getURL();
    if (url !== currentURL) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("assign-window-id", mainWindow.id);
    sendWindowMaximizeState(mainWindow);
  });
}

function createNewWindow(parentWindow, position) {
  const windowBounds = store.get("windowBounds") || { width: 800, height: 600 };

  let x, y;
  if (position && typeof position.x === "number" && typeof position.y === "number") {
    x = position.x;
    y = position.y;
  } else if (parentWindow) {
    const parentBounds = parentWindow.getBounds();
    x = parentBounds.x + 30;
    y = parentBounds.y + 30;
  }

  const win = new BrowserWindow({
    x,
    y,
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 400,
    minHeight: 210,
    backgroundColor: "#000000",
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: WINDOW_CONTROL_OVERLAY,
    // transparent: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, "icon/favicon.ico"),
  });

  win.loadFile(path.join(__dirname, "index.html"));
  bindWindowMaximizeState(win);

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("focus", () => {
    win.webContents.send("window-focus", true);
  });

  win.on("blur", () => {
    win.webContents.send("window-focus", false);
  });

  win.on("resize", () => {
    const { width, height } = win.getBounds();
    store.set("windowBounds", { width, height });
  });

  win.on("close", (e) => {
    if (win.webContents.isDestroyed()) return;
    e.preventDefault();
    win.webContents.send("attempt-close-window");
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const currentURL = win.webContents.getURL();
    if (url !== currentURL) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("assign-window-id", win.id);
    sendWindowMaximizeState(win);
  });

  return win;
}

function createNewWindowWithTab(parentWindow, tabData, position) {
  const newWindow = createNewWindow(parentWindow, position);

  // send tab data when new window is ready
  newWindow.webContents.once("did-finish-load", () => {
    newWindow.webContents.send("load-tab-data", tabData);
  });
}

// app version
ipcMain.handle("get-app-version", () => {
  return {
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
  };
});

ipcMain.handle("get-app-session-id", () => {
  return String(process.pid);
});

// theme folder
ipcMain.handle("get-custom-themes", async () => {
  try {
    const userThemesDir = path.join(app.getPath("userData"), "themes");

    const themesMap = new Map();

    if (fs.existsSync(userThemesDir)) {
      const files = fs.readdirSync(userThemesDir);
      for (const file of files) {
        if (file.endsWith(".css")) {
          const themeName = file.replace(/\.css$/, "");
          const fullPath = path.join(userThemesDir, file);
          themesMap.set(themeName, fullPath);
        }
      }
    }

    return Object.fromEntries(themesMap);
  } catch {
    return {};
  }
});

ipcMain.handle("get-user-data-path", () => {
  return app.getPath("userData");
});

ipcMain.handle("read-css-file", async (event, filePath) => {
  try {
    const cssContent = fs.readFileSync(filePath, "utf8");
    return cssContent;
  } catch (error) {
    console.error("Failed to read CSS file:", error);
    return null;
  }
});

ipcMain.on("watch-css-file", (event, filePath) => {
  if (watchedCssFiles.has(filePath)) return;

  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType === "change") {
      event.sender.send("css-file-updated", filePath);
    }
  });

  watchedCssFiles.set(filePath, watcher);
});

ipcMain.on("unwatch-css-file", (event, filePath) => {
  const watcher = watchedCssFiles.get(filePath);
  if (watcher) {
    watcher.close();
    watchedCssFiles.delete(filePath);
  }
});

// File operations, window control handler
ipcMain.handle("window:createNew", (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  createNewWindow(parentWindow);
});

// open tab in new window
ipcMain.handle("window:createNewWithTab", (event, tabData, position) => {
  // use position if exists
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  return createNewWindowWithTab(parentWindow, tabData, position);
});

// get window id from dimention
ipcMain.handle("window:getIdAt", (_, point) => {
  const win = BrowserWindow.getAllWindows().find(
    (w) =>
      w.getBounds() &&
      w.getBounds().x <= point.x &&
      w.getBounds().x + w.getBounds().width >= point.x &&
      w.getBounds().y <= point.y &&
      w.getBounds().y + w.getBounds().height >= point.y,
  );
  return win?.id || null;
});

// get if target window is minimized or not
ipcMain.handle("isWindowMinimized", (event, windowId) => {
  const win = BrowserWindow.fromId(windowId);
  if (!win) return false;
  return win.isMinimized();
});

// send tab to different window
ipcMain.handle("tab:sendToWindow", (event, targetWindowId, payload) => {
  const targetWin = BrowserWindow.fromId(targetWindowId);
  if (targetWin && !targetWin.isDestroyed()) {
    targetWin.webContents.send("load-tab-data", payload);
  }
});

ipcMain.on("tab:previewDrop", (event, payload) => {
  const targetWin = BrowserWindow.fromId(payload.targetWindowId);
  if (targetWin && !targetWin.isDestroyed()) {
    targetWin.webContents.send("show-external-drop-indicator", {
      dropScreenX: payload.dropScreenX,
      dropScreenY: payload.dropScreenY,
      tabInfo: payload.tabInfo,
    });
  }
});

ipcMain.on("tab:clearPreviewDrop", (event, payload) => {
  const targetWin = BrowserWindow.fromId(payload.targetWindowId);
  if (targetWin && !targetWin.isDestroyed()) {
    targetWin.webContents.send("hide-external-drop-indicator");
  }
});

// focus window after tab is sent
ipcMain.handle("focus-window", (event, windowId) => {
  const win = BrowserWindow.fromId(windowId);
  if (win) {
    win.focus();
  }
});

// get window bounds
ipcMain.handle("window:getMyBounds", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.getBounds();
});

ipcMain.handle("window:getBounds", (event, windowId) => {
  const win = BrowserWindow.fromId(windowId);
  return win && !win.isDestroyed() ? win.getBounds() : null;
});

ipcMain.handle("cursor:getScreenPoint", () => screen.getCursorScreenPoint());

// small window when dragging tab outside toolbar
ipcMain.on("createCursorWindow", () => {
  if (cursorWindow) return;
  lastCursorWindowBounds = null;

  cursorWindow = new BrowserWindow({
    width: 23,
    height: 23,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload-cursor.js"),
    },
  });
  // cursorWindow.webContents.openDevTools({ mode: "detach" });
  cursorWindow.loadFile(path.join(__dirname, "cursor.html"));
});
ipcMain.on("moveCursorWindow", (e, pos) => {
  if (!cursorWindow) return;
  const nextBounds = { x: pos.x + 12, y: pos.y + 12, width: 23, height: 23 };
  if (
    !lastCursorWindowBounds ||
    lastCursorWindowBounds.x !== nextBounds.x ||
    lastCursorWindowBounds.y !== nextBounds.y
  ) {
    cursorWindow.setBounds(nextBounds);
    lastCursorWindowBounds = nextBounds;
  }
  if (!cursorWindow.isVisible()) cursorWindow.showInactive();
});
ipcMain.on("destroyCursorWindow", () => {
  if (cursorWindow) {
    cursorWindow.close();
    cursorWindow = null;
    lastCursorWindowBounds = null;
  }
});
ipcMain.on("setCursorWindowState", (event, state) => {
  if (cursorWindow && !cursorWindow.isDestroyed()) {
    cursorWindow.webContents.send("update-state", state);
  }
});

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ["openFile"] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("dialog:saveFile", async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: defaultName });
  return canceled || !filePath ? {} : { filePath };
});

ipcMain.handle("file:save", async (event, filePath, content, options = {}) => {
  try {
    const text = options?.bom ? `\uFEFF${content}` : content;
    await fs.promises.writeFile(filePath, text, "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function readFileWithUtf8Info(buffer) {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  let isUtf8Valid = true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    isUtf8Valid = false;
  }
  let content = buffer.toString("utf8");
  if (content.length > 0 && content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  return {
    content,
    encoding: isUtf8Valid ? (hasBom ? "UTF-8 with BOM" : "UTF-8") : "Invalid UTF-8",
    isUtf8Valid,
    hasBom,
  };
}

ipcMain.handle("file:read", async (event, filePath) => {
  try {
    return readFileWithUtf8Info(await fs.promises.readFile(filePath)).content;
  } catch {
    return null;
  }
});

ipcMain.handle("file:readWithEncoding", async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return readFileWithUtf8Info(buffer);
  } catch {
    return null;
  }
});

ipcMain.handle("file:exists", async (event, filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
});

function getAutosaveDirs() {
  const root = path.join(app.getPath("userData"), "autosave");
  return {
    root,
    files: path.join(root, "files"),
    drafts: path.join(root, "drafts"),
    trashCurrent: path.join(root, "trash-current"),
    trashPrevious: path.join(root, "trash-previous"),
  };
}

async function ensureAutosaveDirs() {
  const dirs = getAutosaveDirs();
  await Promise.all([
    fs.promises.mkdir(dirs.files, { recursive: true }),
    fs.promises.mkdir(dirs.drafts, { recursive: true }),
    fs.promises.mkdir(dirs.trashCurrent, { recursive: true }),
    fs.promises.mkdir(dirs.trashPrevious, { recursive: true }),
  ]);
  return dirs;
}

function getPathBackupId(filePath) {
  const normalizedPath = process.platform === "win32" ? path.resolve(filePath).toLowerCase() : path.resolve(filePath);
  return crypto.createHash("sha256").update(normalizedPath).digest("hex");
}

function isSafeAutosaveId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(id);
}

async function pathExists(targetPath) {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function removeFileIfExists(targetPath) {
  try {
    await fs.promises.unlink(targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function removeDirIfExists(targetPath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true });
}

async function readJsonFile(targetPath) {
  try {
    return JSON.parse(await fs.promises.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

async function readAutosaveEntry(baseDir, id) {
  if (!isSafeAutosaveId(id)) return null;

  const textPath = path.join(baseDir, `${id}.txt`);
  const metaPath = path.join(baseDir, `${id}.json`);
  const meta = await readJsonFile(metaPath);

  try {
    const content = await fs.promises.readFile(textPath, "utf8");
    const stats = await fs.promises.stat(textPath);
    return { id, content, meta: meta || {}, updatedAt: stats.mtimeMs };
  } catch {
    return null;
  }
}

async function writeAutosaveEntry(baseDir, id, meta, content) {
  if (!isSafeAutosaveId(id)) {
    return { success: false, error: "Invalid autosave id." };
  }

  const contentText = typeof content === "string" ? content : "";
  const contentBytes = Buffer.byteLength(contentText, "utf8");
  const textPath = path.join(baseDir, `${id}.txt`);
  const metaPath = path.join(baseDir, `${id}.json`);

  if (contentBytes > AUTOSAVE_MAX_ITEM_BYTES) {
    await removeFileIfExists(textPath);
    await removeFileIfExists(metaPath);
    return { success: true, skipped: true, reason: "too-large" };
  }

  await fs.promises.mkdir(baseDir, { recursive: true });
  const now = Date.now();
  const nextMeta = {
    ...meta,
    id,
    contentBytes,
    updatedAt: now,
    createdAt: meta?.createdAt || now,
  };

  const tempTextPath = `${textPath}.${process.pid}.tmp`;
  const tempMetaPath = `${metaPath}.${process.pid}.tmp`;

  await fs.promises.writeFile(tempTextPath, contentText, "utf8");
  await fs.promises.writeFile(tempMetaPath, JSON.stringify(nextMeta, null, 2), "utf8");
  await fs.promises.rename(tempTextPath, textPath);
  await fs.promises.rename(tempMetaPath, metaPath);

  cleanupAutosaveStorage().catch((error) => log.warn("[autosave] cleanup failed:", error.message));

  return { success: true, id };
}

async function deleteAutosaveEntry(baseDir, id) {
  if (!isSafeAutosaveId(id)) return;
  await Promise.all([
    removeFileIfExists(path.join(baseDir, `${id}.txt`)),
    removeFileIfExists(path.join(baseDir, `${id}.json`)),
  ]);
}

async function listAutosaveEntries(baseDir) {
  try {
    const files = await fs.promises.readdir(baseDir);
    const ids = files.filter((file) => file.endsWith(".txt")).map((file) => file.replace(/\.txt$/, ""));
    const entries = await Promise.all(ids.map((id) => readAutosaveEntry(baseDir, id)));
    return entries.filter(Boolean).sort((a, b) => a.updatedAt - b.updatedAt);
  } catch {
    return [];
  }
}

async function rotateAutosaveTrash() {
  const dirs = getAutosaveDirs();
  await fs.promises.mkdir(dirs.root, { recursive: true });
  await removeDirIfExists(dirs.trashPrevious);
  if (await pathExists(dirs.trashCurrent)) {
    await fs.promises.rename(dirs.trashCurrent, dirs.trashPrevious).catch(async () => {
      await removeDirIfExists(dirs.trashCurrent);
      await fs.promises.mkdir(dirs.trashPrevious, { recursive: true });
    });
  }
  await ensureAutosaveDirs();
}

async function cleanupAutosaveStorage() {
  const dirs = await ensureAutosaveDirs();
  const fileEntries = await listAutosaveEntries(dirs.files);

  for (const entry of fileEntries) {
    const filePath = entry.meta?.path;
    if (!filePath) {
      await deleteAutosaveEntry(dirs.files, entry.id);
      continue;
    }

    try {
      const fileStats = await fs.promises.stat(filePath);
      if (entry.updatedAt <= fileStats.mtimeMs) {
        await deleteAutosaveEntry(dirs.files, entry.id);
      }
    } catch {
      await deleteAutosaveEntry(dirs.files, entry.id);
    }
  }

  const allDirs = [dirs.files, dirs.drafts, dirs.trashCurrent, dirs.trashPrevious];
  const allFiles = [];
  for (const dir of allDirs) {
    try {
      const names = await fs.promises.readdir(dir);
      for (const name of names) {
        const fullPath = path.join(dir, name);
        const stats = await fs.promises.stat(fullPath);
        if (stats.isFile()) allFiles.push({ path: fullPath, size: stats.size, mtimeMs: stats.mtimeMs });
      }
    } catch {
      // ignore missing autosave folders
    }
  }

  let totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize <= AUTOSAVE_MAX_TOTAL_BYTES) return;

  const priority = (filePath) => {
    if (filePath.startsWith(dirs.trashPrevious) || filePath.startsWith(dirs.trashCurrent)) return 0;
    if (filePath.startsWith(dirs.drafts)) return 1;
    return 2;
  };

  allFiles.sort((a, b) => priority(a.path) - priority(b.path) || a.mtimeMs - b.mtimeMs);
  for (const file of allFiles) {
    if (totalSize <= AUTOSAVE_MAX_TOTAL_BYTES) break;
    await removeFileIfExists(file.path);
    totalSize -= file.size;
  }
}

ipcMain.handle("autosave:write", async (event, payload = {}) => {
  try {
    const dirs = await ensureAutosaveDirs();
    const content = typeof payload.content === "string" ? payload.content : "";
    const ownerId = Number.isInteger(payload.ownerId) ? payload.ownerId : null;

    if (payload.kind === "file") {
      if (!payload.filePath) return { success: false, error: "Missing file path." };
      const id = getPathBackupId(payload.filePath);
      return await writeAutosaveEntry(
        dirs.files,
        id,
        {
          kind: "file",
          path: payload.filePath,
          name: payload.name || path.basename(payload.filePath),
          index: Number.isInteger(payload.index) ? payload.index : null,
          ownerId,
        },
        content,
      );
    }

    if (payload.kind === "draft") {
      const id = isSafeAutosaveId(payload.draftId) ? payload.draftId : crypto.randomUUID();
      return await writeAutosaveEntry(
        dirs.drafts,
        id,
        {
          kind: "draft",
          name: payload.name || "Untitled.txt",
          index: Number.isInteger(payload.index) ? payload.index : null,
          ownerId,
        },
        content,
      );
    }

    return { success: false, error: "Invalid autosave kind." };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("autosave:get-file-backup", async (event, filePath) => {
  try {
    if (!filePath) return { exists: false };

    const dirs = await ensureAutosaveDirs();
    const id = getPathBackupId(filePath);
    const entry = await readAutosaveEntry(dirs.files, id);
    if (!entry) return { exists: false };

    const fileStats = await fs.promises.stat(filePath);
    if (entry.updatedAt <= fileStats.mtimeMs) {
      await deleteAutosaveEntry(dirs.files, id);
      return { exists: false };
    }

    return {
      exists: true,
      id,
      content: entry.content,
      meta: entry.meta,
      backupMtime: entry.updatedAt,
      fileMtime: fileStats.mtimeMs,
    };
  } catch {
    return { exists: false };
  }
});

ipcMain.handle("autosave:discard-file-backup", async (event, filePath) => {
  try {
    if (!filePath) return { success: true };
    const dirs = await ensureAutosaveDirs();
    await deleteAutosaveEntry(dirs.files, getPathBackupId(filePath));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("autosave:list-drafts", async (event, payload = {}) => {
  try {
    const dirs = await ensureAutosaveDirs();
    const ownerId = Number.isInteger(payload.ownerId) ? payload.ownerId : null;
    const requesterWindow = BrowserWindow.fromWebContents(event.sender);
    const shouldClaimRecovery = !autosaveDraftRecoveryClaimed && mainWindow && requesterWindow?.id === mainWindow.id;
    if (shouldClaimRecovery) autosaveDraftRecoveryClaimed = true;

    const drafts = await listAutosaveEntries(dirs.drafts);
    return drafts
      .filter((entry) => {
        if (shouldClaimRecovery) return true;
        return ownerId !== null && entry.meta?.ownerId === ownerId;
      })
      .map((entry) => ({
        id: entry.id,
        name: entry.meta?.name || "Untitled.txt",
        content: entry.content,
        index: Number.isInteger(entry.meta?.index) ? entry.meta.index : null,
        ownerId: Number.isInteger(entry.meta?.ownerId) ? entry.meta.ownerId : null,
        updatedAt: entry.updatedAt,
      }))
      .sort((a, b) => {
        const aIndex = Number.isInteger(a.index) ? a.index : Number.MAX_SAFE_INTEGER;
        const bIndex = Number.isInteger(b.index) ? b.index : Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex || a.updatedAt - b.updatedAt;
      });
  } catch {
    return [];
  }
});

ipcMain.handle("autosave:delete-draft", async (event, draftId) => {
  try {
    const dirs = await ensureAutosaveDirs();
    await deleteAutosaveEntry(dirs.drafts, draftId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("autosave:move-draft-to-trash", async (event, payload = {}) => {
  try {
    const dirs = await ensureAutosaveDirs();
    const sourceId = payload.draftId;
    const trashId = crypto.randomUUID();
    const content = typeof payload.content === "string" ? payload.content : "";
    const name = payload.name || "Untitled.txt";
    const ownerId = Number.isInteger(payload.ownerId) ? payload.ownerId : null;

    if (isSafeAutosaveId(sourceId)) {
      const source = await readAutosaveEntry(dirs.drafts, sourceId);
      if (source) {
        await writeAutosaveEntry(
          dirs.trashCurrent,
          trashId,
          { kind: "trash", name: source.meta?.name || name, fromDraftId: sourceId, ownerId },
          source.content,
        );
        await deleteAutosaveEntry(dirs.drafts, sourceId);
        return { success: true, trashId, name: source.meta?.name || name };
      }
    }

    if (content.trim()) {
      await writeAutosaveEntry(
        dirs.trashCurrent,
        trashId,
        { kind: "trash", name, fromDraftId: sourceId || null, ownerId },
        content,
      );
      return { success: true, trashId, name };
    }

    return { success: false, error: "No draft content." };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("autosave:read-trash", async (event, trashId) => {
  try {
    const dirs = await ensureAutosaveDirs();
    const entry = await readAutosaveEntry(dirs.trashCurrent, trashId);
    if (!entry) return { exists: false };
    return { exists: true, id: entry.id, name: entry.meta?.name || "Untitled.txt", content: entry.content };
  } catch {
    return { exists: false };
  }
});

ipcMain.handle("autosave:delete-trash", async (event, trashId) => {
  try {
    const dirs = await ensureAutosaveDirs();
    await deleteAutosaveEntry(dirs.trashCurrent, trashId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("autosave:get-trash-previous-path", async () => {
  const dirs = await ensureAutosaveDirs();
  return dirs.trashPrevious;
});

function getNotesDir() {
  return path.join(app.getPath("userData"), "notes");
}

function getNotesIndexPath() {
  return path.join(getNotesDir(), "notes.json");
}

async function ensureNotesDir() {
  const notesDir = getNotesDir();
  await fs.promises.mkdir(notesDir, { recursive: true });
  return notesDir;
}

function isSafeNoteId(id) {
  return typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id);
}

function normalizeFolderPath(folderPath) {
  const value = String(folderPath || "")
    .replace(/\\/g, "/")
    .trim();
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === ".." || !isSafeFolderName(part))) return "";
  return parts.join("/");
}

const FOLDER_NAME_MAX_LENGTH = 100;

function isSafeFolderName(name) {
  const value = String(name || "").trim();
  return (
    Boolean(value) &&
    value.length <= FOLDER_NAME_MAX_LENGTH &&
    value !== "." &&
    value !== ".." &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(value)
  );
}

function getFolderParentPath(folderPath) {
  const value = normalizeFolderPath(folderPath);
  const index = value.lastIndexOf("/");
  return index === -1 ? "" : value.slice(0, index);
}

function getFolderName(folderPath) {
  const value = normalizeFolderPath(folderPath);
  return value.split("/").filter(Boolean).pop() || "";
}

function getFolderDiskPath(notesDir, folderPath) {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? path.join(notesDir, ...normalized.split("/")) : notesDir;
}

function getNoteDiskPath(notesDir, note) {
  return path.join(getFolderDiskPath(notesDir, note?.folderPath), `${note.id}.txt`);
}

function getEntryKey(entry) {
  return `${entry.type || "note"}:${entry.type === "folder" ? entry.path : entry.id}`;
}

function getDirectEntries(index, folderPath = "") {
  const parentPath = normalizeFolderPath(folderPath);
  return [
    ...index.folders.filter((folder) => normalizeFolderPath(folder.parentPath) === parentPath),
    ...index.notes.filter((note) => normalizeFolderPath(note.folderPath) === parentPath),
  ];
}

function getFolderNoteCount(index, folderPath = "") {
  const normalized = normalizeFolderPath(folderPath);
  return index.notes.filter((note) => normalizeFolderPath(note.folderPath) === normalized).length;
}

function withFolderNoteCounts(index, entries) {
  return entries.map((entry) =>
    entry?.type === "folder" ? { ...entry, noteCount: getFolderNoteCount(index, entry.path) } : entry,
  );
}

async function withNoteHeadingMeta(entries) {
  const notesDir = await ensureNotesDir();
  return Promise.all(
    entries.map(async (entry) => {
      if (entry?.type === "folder" || typeof entry?.hasHeadings === "boolean") return entry;
      try {
        const content = await fs.promises.readFile(getNoteDiskPath(notesDir, entry), "utf8");
        return { ...entry, hasHeadings: contentHasHeading(content) };
      } catch {
        return { ...entry, hasHeadings: false };
      }
    }),
  );
}

function sortEntriesForFolder(entries) {
  return [...entries].sort((a, b) => {
    if (Boolean(a?.pinned) !== Boolean(b?.pinned)) return a?.pinned ? -1 : 1;
    const aOrder = Number.isFinite(a?.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(b?.order) ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a?.createdAt || 0) - (b?.createdAt || 0);
  });
}

function normalizeFolderEntryOrder(index, folderPath = "") {
  sortEntriesForFolder(getDirectEntries(index, folderPath)).forEach((entry, order) => {
    entry.order = order;
  });
}

function normalizeAllEntryOrders(index) {
  const folderPaths = new Set([""]);
  for (const folder of index.folders) {
    folderPaths.add(normalizeFolderPath(folder.parentPath));
  }
  for (const note of index.notes) {
    folderPaths.add(normalizeFolderPath(note.folderPath));
  }
  folderPaths.forEach((folderPath) => normalizeFolderEntryOrder(index, folderPath));
  return index;
}

async function readNotesIndex() {
  await ensureNotesDir();
  const index = await readJsonFile(getNotesIndexPath());
  if (!index || typeof index !== "object") {
    return { version: 2, notes: [], folders: [] };
  }

  return {
    version: 2,
    notes: Array.isArray(index.notes)
      ? index.notes
          .filter((note) => isSafeNoteId(note?.id))
          .map((note) => {
            return {
              type: "note",
              id: note.id,
              fileName: typeof note.fileName === "string" ? note.fileName : `${note.id}.txt`,
              folderPath: normalizeFolderPath(note.folderPath),
              title: note.title,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
              pinned: Boolean(note.pinned),
              order: Number.isFinite(note.order) ? note.order : Number.MAX_SAFE_INTEGER,
              contentBytes: note.contentBytes,
              hasHeadings: typeof note.hasHeadings === "boolean" ? note.hasHeadings : null,
            };
          })
      : [],
    folders: Array.isArray(index.folders)
      ? index.folders
          .map((folder) => {
            const folderPath = normalizeFolderPath(folder?.path);
            if (!folderPath) return null;
            return {
              ...folder,
              type: "folder",
              path: folderPath,
              name: getFolderName(folderPath),
              parentPath: getFolderParentPath(folderPath),
            };
          })
          .filter(Boolean)
      : [],
  };
}

async function writeNotesIndex(index) {
  await ensureNotesDir();
  const targetPath = getNotesIndexPath();
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(index, null, 2), "utf8");
  await fs.promises.rename(tempPath, targetPath);
}

const NOTE_TITLE_MAX_LENGTH = 100;

function truncateNoteTitle(title) {
  const value = String(title || "").trim();
  if (value.length <= NOTE_TITLE_MAX_LENGTH) return value;
  return `${value.slice(0, NOTE_TITLE_MAX_LENGTH)}...`;
}

function getNoteTitleFromContent(content) {
  const firstTextLine = String(content || "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return truncateNoteTitle(firstTextLine || "New Note");
}

function contentHasHeading(content) {
  let inCodeBlock = false;
  for (const line of String(content || "").split(/\r\n|\r|\n/)) {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && /^\s*#{1,3}\s[^#]/.test(line)) return true;
  }
  return false;
}

async function upsertNoteIndexEntry(noteId, content, extra = {}) {
  const notesDir = await ensureNotesDir();
  const index = await readNotesIndex();
  const now = Date.now();
  const title = truncateNoteTitle(extra.title || getNoteTitleFromContent(content));
  const contentBytes = Buffer.byteLength(typeof content === "string" ? content : "", "utf8");
  const existing = index.notes.find((note) => note.id === noteId);
  const folderPath = normalizeFolderPath(extra.folderPath ?? existing?.folderPath);
  const siblingEntries = getDirectEntries(index, folderPath);
  const maxOrder = siblingEntries.reduce(
    (max, entry) => Math.max(max, Number.isFinite(entry.order) ? entry.order : -1),
    -1,
  );
  const minUnpinnedOrder = siblingEntries
    .filter((entry) => !entry.pinned)
    .reduce((min, note) => Math.min(min, Number.isFinite(note.order) ? note.order : 0), 0);
  const nextEntry = {
    type: "note",
    id: noteId,
    fileName: `${noteId}.txt`,
    folderPath,
    title,
    createdAt: existing?.createdAt || extra.createdAt || now,
    updatedAt: now,
    pinned: Boolean(existing?.pinned),
    order: Number.isFinite(existing?.order) ? existing.order : extra.insertAtTop ? minUnpinnedOrder - 1 : maxOrder + 1,
    contentBytes,
    hasHeadings: contentHasHeading(content),
  };

  if (existing) {
    Object.assign(existing, nextEntry);
  } else {
    index.notes.push(nextEntry);
    normalizeFolderEntryOrder(index, folderPath);
  }

  await writeNotesIndex(index);
  return { ...nextEntry, path: getNoteDiskPath(notesDir, nextEntry) };
}

ipcMain.handle("notes:create", async (event, payload = {}) => {
  try {
    const notesDir = await ensureNotesDir();
    const noteId = crypto.randomUUID();
    const content = typeof payload.content === "string" ? payload.content : "";
    const folderPath = normalizeFolderPath(payload.folderPath);
    const notePath = path.join(getFolderDiskPath(notesDir, folderPath), `${noteId}.txt`);
    await fs.promises.mkdir(path.dirname(notePath), { recursive: true });
    await fs.promises.writeFile(notePath, content, "utf8");
    const meta = await upsertNoteIndexEntry(noteId, content, {
      title: payload.title,
      folderPath,
      insertAtTop: true,
    });
    return { success: true, id: noteId, path: notePath, meta };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:write", async (event, payload = {}) => {
  try {
    if (!isSafeNoteId(payload.noteId)) return { success: false, error: "Invalid note id." };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const existing = index.notes.find((note) => note.id === payload.noteId);
    const folderPath = normalizeFolderPath(existing?.folderPath ?? payload.folderPath);
    const content = typeof payload.content === "string" ? payload.content : "";
    const notePath = path.join(getFolderDiskPath(notesDir, folderPath), `${payload.noteId}.txt`);
    await fs.promises.mkdir(path.dirname(notePath), { recursive: true });
    await fs.promises.writeFile(notePath, content, "utf8");
    const meta = await upsertNoteIndexEntry(payload.noteId, content, { title: payload.title, folderPath });
    return { success: true, id: payload.noteId, path: notePath, meta };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:read", async (event, noteId) => {
  try {
    if (!isSafeNoteId(noteId)) return { exists: false };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const meta = index.notes.find((note) => note.id === noteId);
    const notePath = meta ? getNoteDiskPath(notesDir, meta) : path.join(notesDir, `${noteId}.txt`);
    const content = await fs.promises.readFile(notePath, "utf8");
    const nextMeta = meta || (await upsertNoteIndexEntry(noteId, content));
    return { exists: true, id: noteId, path: notePath, content, meta: nextMeta };
  } catch {
    return { exists: false };
  }
});

ipcMain.handle("notes:exists", async (event, noteId) => {
  try {
    if (!isSafeNoteId(noteId)) return false;
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const note = index.notes.find((item) => item.id === noteId) || { id: noteId, folderPath: "" };
    await fs.promises.access(getNoteDiskPath(notesDir, note), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("notes:delete", async (event, noteId) => {
  try {
    if (!isSafeNoteId(noteId)) return { success: false, error: "Invalid note id." };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const note = index.notes.find((item) => item.id === noteId) || { id: noteId, folderPath: "" };
    await removeFileIfExists(getNoteDiskPath(notesDir, note));
    index.notes = index.notes.filter((note) => note.id !== noteId);
    normalizeAllEntryOrders(index);
    await writeNotesIndex(index);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:trash", async (event, noteId) => {
  try {
    if (!isSafeNoteId(noteId)) return { success: false, error: "Invalid note id." };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const note = index.notes.find((item) => item.id === noteId) || { id: noteId, folderPath: "" };
    const notePath = getNoteDiskPath(notesDir, note);
    await shell.trashItem(notePath).catch(async () => {
      await removeFileIfExists(notePath);
    });
    index.notes = index.notes.filter((note) => note.id !== noteId);
    normalizeAllEntryOrders(index);
    await writeNotesIndex(index);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:duplicate", async (event, noteId) => {
  try {
    if (!isSafeNoteId(noteId)) return { success: false, error: "Invalid note id." };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const source = index.notes.find((item) => item.id === noteId);
    const sourcePath = getNoteDiskPath(notesDir, source || { id: noteId, folderPath: "" });
    const content = await fs.promises.readFile(sourcePath, "utf8");
    const newId = crypto.randomUUID();
    const folderPath = normalizeFolderPath(source?.folderPath);
    const newPath = path.join(getFolderDiskPath(notesDir, folderPath), `${newId}.txt`);
    await fs.promises.writeFile(newPath, content, "utf8");
    const meta = await upsertNoteIndexEntry(newId, content, {
      title: getNoteTitleFromContent(content),
      folderPath,
      insertAtTop: true,
    });
    return { success: true, id: newId, path: newPath, meta };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:update-meta", async (event, payload = {}) => {
  try {
    if (!isSafeNoteId(payload.noteId)) return { success: false, error: "Invalid note id." };
    const index = await readNotesIndex();
    const note = index.notes.find((item) => item.id === payload.noteId);
    if (!note) return { success: false, error: "Note not found." };
    if (typeof payload.pinned === "boolean") {
      note.pinned = payload.pinned;
      if (payload.pinned) {
        const siblings = getDirectEntries(index, note.folderPath).filter(
          (item) => getEntryKey(item) !== getEntryKey(note),
        );
        note.order = Math.min(-1, ...siblings.filter((item) => item.pinned).map((item) => item.order || 0)) - 1;
      }
    }
    normalizeFolderEntryOrder(index, note.folderPath);
    await writeNotesIndex(index);
    return { success: true, note };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("folders:create", async (event, payload = {}) => {
  try {
    const name = String(payload.name || "").trim();
    if (!isSafeFolderName(name)) return { success: false, error: "Invalid folder name." };
    const parentPath = normalizeFolderPath(payload.parentPath);
    const folderPath = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    if (index.folders.some((folder) => normalizeFolderPath(folder.path).toLowerCase() === folderPath.toLowerCase())) {
      return { success: false, error: "Folder already exists." };
    }
    if (parentPath && !index.folders.some((folder) => normalizeFolderPath(folder.path) === parentPath)) {
      return { success: false, error: "Parent folder not found." };
    }
    await fs.promises.mkdir(getFolderDiskPath(notesDir, folderPath), { recursive: false });
    const now = Date.now();
    const siblings = getDirectEntries(index, parentPath);
    const minUnpinnedOrder = siblings
      .filter((entry) => !entry.pinned)
      .reduce((min, entry) => Math.min(min, entry.order || 0), 0);
    const folder = {
      type: "folder",
      path: folderPath,
      name,
      parentPath,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      order: minUnpinnedOrder - 1,
    };
    index.folders.push(folder);
    normalizeFolderEntryOrder(index, parentPath);
    await writeNotesIndex(index);
    return { success: true, folder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("folders:rename", async (event, payload = {}) => {
  try {
    const folderPath = normalizeFolderPath(payload.folderPath);
    const name = String(payload.name || "").trim();
    if (!folderPath || !isSafeFolderName(name)) return { success: false, error: "Invalid folder name." };
    const index = await readNotesIndex();
    const folder = index.folders.find((item) => normalizeFolderPath(item.path) === folderPath);
    if (!folder) return { success: false, error: "Folder not found." };
    const parentPath = normalizeFolderPath(folder.parentPath);
    const nextPath = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
    if (nextPath === folderPath) return { success: true, folder };
    if (index.folders.some((item) => normalizeFolderPath(item.path).toLowerCase() === nextPath.toLowerCase())) {
      return { success: false, error: "Folder already exists." };
    }

    const notesDir = await ensureNotesDir();
    await fs.promises.rename(getFolderDiskPath(notesDir, folderPath), getFolderDiskPath(notesDir, nextPath));
    const oldPrefix = `${folderPath}/`;
    const nextPrefix = `${nextPath}/`;
    for (const item of index.folders) {
      if (item.path === folderPath) {
        item.path = nextPath;
        item.name = name;
        item.parentPath = parentPath;
        item.updatedAt = Date.now();
      } else if (item.path.startsWith(oldPrefix)) {
        item.path = `${nextPrefix}${item.path.slice(oldPrefix.length)}`;
        item.parentPath = getFolderParentPath(item.path);
        item.name = getFolderName(item.path);
      }
    }
    for (const note of index.notes) {
      if (note.folderPath === folderPath) note.folderPath = nextPath;
      else if (note.folderPath?.startsWith(oldPrefix))
        note.folderPath = `${nextPrefix}${note.folderPath.slice(oldPrefix.length)}`;
    }
    normalizeAllEntryOrders(index);
    await writeNotesIndex(index);
    return { success: true, folder: index.folders.find((item) => item.path === nextPath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("folders:delete", async (event, folderPathInput) => {
  try {
    const folderPath = normalizeFolderPath(folderPathInput);
    if (!folderPath) return { success: false, error: "Invalid folder path." };
    const notesDir = await ensureNotesDir();
    const index = await readNotesIndex();
    const folder = index.folders.find((item) => item.path === folderPath);
    if (!folder) return { success: false, error: "Folder not found." };
    const oldPrefix = `${folderPath}/`;
    const folderDiskPath = getFolderDiskPath(notesDir, folderPath);
    await shell.trashItem(folderDiskPath).catch(async () => {
      await fs.promises.rm(folderDiskPath, { recursive: true, force: true });
    });
    index.folders = index.folders.filter((item) => item.path !== folderPath && !item.path.startsWith(oldPrefix));
    index.notes = index.notes.filter(
      (note) => note.folderPath !== folderPath && !note.folderPath?.startsWith(oldPrefix),
    );
    normalizeAllEntryOrders(index);
    await writeNotesIndex(index);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("folders:update-meta", async (event, payload = {}) => {
  try {
    const folderPath = normalizeFolderPath(payload.folderPath);
    const index = await readNotesIndex();
    const folder = index.folders.find((item) => item.path === folderPath);
    if (!folder) return { success: false, error: "Folder not found." };
    if (typeof payload.pinned === "boolean") {
      folder.pinned = payload.pinned;
      if (payload.pinned) {
        const siblings = getDirectEntries(index, folder.parentPath).filter(
          (item) => getEntryKey(item) !== getEntryKey(folder),
        );
        folder.order = Math.min(-1, ...siblings.filter((item) => item.pinned).map((item) => item.order || 0)) - 1;
      }
    }
    normalizeFolderEntryOrder(index, folder.parentPath);
    await writeNotesIndex(index);
    return { success: true, folder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:move-entry", async (event, payload = {}) => {
  try {
    const entryType = payload.entryType === "folder" ? "folder" : "note";
    const targetFolderPath = normalizeFolderPath(payload.targetFolderPath);
    const index = await readNotesIndex();
    const notesDir = await ensureNotesDir();

    if (targetFolderPath && !index.folders.some((folder) => folder.path === targetFolderPath)) {
      return { success: false, error: "Target folder not found." };
    }

    if (entryType === "note") {
      if (!isSafeNoteId(payload.noteId)) return { success: false, error: "Invalid note id." };
      const note = index.notes.find((item) => item.id === payload.noteId);
      if (!note) return { success: false, error: "Note not found." };
      const sourceFolderPath = normalizeFolderPath(note.folderPath);
      if (sourceFolderPath === targetFolderPath) return { success: true, entry: note };

      const sourcePath = getNoteDiskPath(notesDir, note);
      const nextNote = { ...note, folderPath: targetFolderPath };
      const targetPath = getNoteDiskPath(notesDir, nextNote);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.rename(sourcePath, targetPath);
      note.folderPath = targetFolderPath;
      const siblings = getDirectEntries(index, targetFolderPath).filter(
        (entry) => getEntryKey(entry) !== getEntryKey(note),
      );
      const targetGroup = siblings.filter((entry) => Boolean(entry.pinned) === Boolean(note.pinned));
      note.order = Math.min(-1, ...targetGroup.map((entry) => entry.order || 0)) - 1;
      normalizeFolderEntryOrder(index, sourceFolderPath);
      normalizeFolderEntryOrder(index, targetFolderPath);
      await writeNotesIndex(index);
      return { success: true, entry: note };
    }

    const folderPath = normalizeFolderPath(payload.folderPath);
    const folder = index.folders.find((item) => item.path === folderPath);
    if (!folder) return { success: false, error: "Folder not found." };
    const sourceParentPath = normalizeFolderPath(folder.parentPath);
    if (sourceParentPath === targetFolderPath) return { success: true, entry: folder };
    if (targetFolderPath === folderPath || targetFolderPath.startsWith(`${folderPath}/`)) {
      return { success: false, error: "Cannot move a folder into itself." };
    }

    const nextPath = normalizeFolderPath(targetFolderPath ? `${targetFolderPath}/${folder.name}` : folder.name);
    if (index.folders.some((item) => item.path.toLowerCase() === nextPath.toLowerCase())) {
      return { success: false, error: "Folder already exists." };
    }

    await fs.promises.rename(getFolderDiskPath(notesDir, folderPath), getFolderDiskPath(notesDir, nextPath));
    const oldPrefix = `${folderPath}/`;
    const nextPrefix = `${nextPath}/`;
    for (const item of index.folders) {
      if (item.path === folderPath) {
        item.path = nextPath;
        item.parentPath = targetFolderPath;
        item.updatedAt = Date.now();
      } else if (item.path.startsWith(oldPrefix)) {
        item.path = `${nextPrefix}${item.path.slice(oldPrefix.length)}`;
        item.parentPath = getFolderParentPath(item.path);
        item.name = getFolderName(item.path);
      }
    }
    for (const note of index.notes) {
      if (note.folderPath === folderPath) note.folderPath = nextPath;
      else if (note.folderPath?.startsWith(oldPrefix))
        note.folderPath = `${nextPrefix}${note.folderPath.slice(oldPrefix.length)}`;
    }
    const movedFolder = index.folders.find((item) => item.path === nextPath);
    const siblings = getDirectEntries(index, targetFolderPath).filter(
      (entry) => getEntryKey(entry) !== getEntryKey(movedFolder),
    );
    const targetGroup = siblings.filter((entry) => Boolean(entry.pinned) === Boolean(movedFolder.pinned));
    movedFolder.order = Math.min(-1, ...targetGroup.map((entry) => entry.order || 0)) - 1;
    normalizeFolderEntryOrder(index, sourceParentPath);
    normalizeFolderEntryOrder(index, targetFolderPath);
    await writeNotesIndex(index);
    return { success: true, entry: movedFolder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:reorder", async (event, payload = {}) => {
  try {
    const folderPath = normalizeFolderPath(payload.folderPath);
    const orderedKeys = Array.isArray(payload.orderedKeys)
      ? payload.orderedKeys.map(String)
      : Array.isArray(payload.orderedIds)
        ? payload.orderedIds.filter(isSafeNoteId).map((id) => `note:${id}`)
        : [];
    const index = await readNotesIndex();
    const keyToPosition = new Map(orderedKeys.map((key, order) => [key, order]));
    for (const entry of getDirectEntries(index, folderPath)) {
      const key = getEntryKey(entry);
      if (keyToPosition.has(key)) entry.order = keyToPosition.get(key);
    }
    normalizeFolderEntryOrder(index, folderPath);
    await writeNotesIndex(index);
    return { success: true, entries: sortEntriesForFolder(getDirectEntries(index, folderPath)), notes: index.notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("notes:list", async (event, payload = {}) => {
  const index = await readNotesIndex();
  if (payload && Object.prototype.hasOwnProperty.call(payload, "folderPath")) {
    const entries = withFolderNoteCounts(index, getDirectEntries(index, payload.folderPath));
    return sortEntriesForFolder(await withNoteHeadingMeta(entries));
  }
  return await withNoteHeadingMeta(index.notes);
});

ipcMain.handle("notes:refresh-index", async () => {
  const notesDir = await ensureNotesDir();
  const index = await readNotesIndex();
  const existingById = new Map(index.notes.map((note) => [note.id, note]));
  const existingFoldersByPath = new Map(index.folders.map((folder) => [folder.path, folder]));
  const foundFiles = [];
  const foundFolders = new Set();

  async function scanFolder(folderPath = "") {
    const dir = getFolderDiskPath(notesDir, folderPath);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === "notes.json") continue;
      const childPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const normalized = normalizeFolderPath(childPath);
        if (!normalized) continue;
        foundFolders.add(normalized);
        await scanFolder(normalized);
      } else if (entry.isFile() && entry.name.endsWith(".txt")) {
        const noteId = path.basename(entry.name, ".txt");
        if (isSafeNoteId(noteId)) foundFiles.push({ noteId, folderPath });
      }
    }
  }

  await scanFolder("");
  const nextNotes = [];

  for (const { noteId, folderPath } of foundFiles) {
    const fileName = `${noteId}.txt`;
    const notePath = path.join(getFolderDiskPath(notesDir, folderPath), fileName);
    try {
      const [content, stat] = await Promise.all([fs.promises.readFile(notePath, "utf8"), fs.promises.stat(notePath)]);
      const existing = existingById.get(noteId);
      nextNotes.push({
        type: "note",
        id: noteId,
        fileName,
        folderPath,
        title: getNoteTitleFromContent(content),
        createdAt: existing?.createdAt || stat.birthtimeMs || stat.ctimeMs || Date.now(),
        updatedAt: Math.max(existing?.updatedAt || 0, stat.mtimeMs || 0) || Date.now(),
        pinned: Boolean(existing?.pinned) && normalizeFolderPath(existing?.folderPath) === folderPath,
        order: Number.isFinite(existing?.order) ? existing.order : Number.MAX_SAFE_INTEGER,
        contentBytes: Buffer.byteLength(content, "utf8"),
        hasHeadings: contentHasHeading(content),
      });
    } catch {
      // Missing or unreadable notes are dropped from the refreshed index.
    }
  }

  index.notes = nextNotes;
  index.folders = [...foundFolders].map((folderPath) => {
    const existing = existingFoldersByPath.get(folderPath);
    return {
      type: "folder",
      path: folderPath,
      name: getFolderName(folderPath),
      parentPath: getFolderParentPath(folderPath),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: existing?.updatedAt || Date.now(),
      pinned: Boolean(existing?.pinned),
      order: Number.isFinite(existing?.order) ? existing.order : Number.MAX_SAFE_INTEGER,
    };
  });
  normalizeAllEntryOrders(index);
  await writeNotesIndex(index);
  return index.notes;
});

async function cleanupEmptyNotes() {
  const notesDir = await ensureNotesDir();
  const index = await readNotesIndex();
  const nextNotes = [];

  for (const note of index.notes) {
    if (!isSafeNoteId(note.id)) continue;
    const notePath = getNoteDiskPath(notesDir, note);
    try {
      const content = await fs.promises.readFile(notePath, "utf8");
      if (content.trim()) {
        nextNotes.push(note);
      } else {
        await removeFileIfExists(notePath);
      }
    } catch {
      // Drop missing files from the index.
    }
  }

  if (nextNotes.length !== index.notes.length) {
    index.notes = nextNotes;
    normalizeAllEntryOrders(index);
    await writeNotesIndex(index);
  }
}

ipcMain.handle("file:watch", (event, filePath) => {
  if (watchers.has(filePath)) {
    watcherRefCounts.set(filePath, (watcherRefCounts.get(filePath) || 0) + 1);
    return { success: true };
  }

  try {
    const scheduleChange = (eventType) => {
      const prev = watchEvents.get(filePath);

      // Merge event types (rename has priority)
      const mergedType = eventType === "rename" || prev === "rename" ? "rename" : "change";

      watchEvents.set(filePath, mergedType);

      if (watchTimeouts.has(filePath)) {
        clearTimeout(watchTimeouts.get(filePath));
      }

      const timeout = setTimeout(async () => {
        watchTimeouts.delete(filePath);

        const finalType = watchEvents.get(filePath);
        watchEvents.delete(filePath);

        if (finalType === "rename") {
          try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            const record = watchers.get(filePath);
            if (record && !record.fileWatcher) {
              record.fileWatcher = attachFileWatcher();
            }
            sendToAllWindows("file:changed", {
              filePath,
              eventType: "change",
            });
          } catch {
            const record = watchers.get(filePath);
            if (record?.fileWatcher) {
              record.fileWatcher.close();
              record.fileWatcher = null;
            }
            sendToAllWindows("file:changed", {
              filePath,
              eventType: "rename",
            });
          }
        } else {
          sendToAllWindows("file:changed", {
            filePath,
            eventType: "change",
          });
        }
      }, 200);

      watchTimeouts.set(filePath, timeout);
    };

    const attachFileWatcher = () => {
      try {
        return fs.watch(filePath, (eventType) => {
          scheduleChange(eventType);
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        log.warn("file watch target missing, falling back to parent directory:", filePath);
        return null;
      }
    };

    let fileWatcher = null;
    fileWatcher = attachFileWatcher();

    const dirPath = path.dirname(filePath);
    const baseName = path.basename(filePath);
    const dirWatcher = fs.watch(dirPath, (eventType, filename) => {
      if (filename && filename.toString() !== baseName) return;
      const record = watchers.get(filePath);
      if (record && !record.fileWatcher && fs.existsSync(filePath)) {
        record.fileWatcher = attachFileWatcher();
      }
      scheduleChange(eventType === "rename" ? "rename" : "change");
    });

    watchers.set(filePath, { fileWatcher, dirWatcher });
    watcherRefCounts.set(filePath, 1);
    return { success: true };
  } catch (err) {
    log.error("watch error:", err);
    return { success: false, error: err.message };
  }
});

function sendToAllWindows(channel, data) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

function getLanIPv4Address() {
  const interfaces = os.networkInterfaces();
  const fallback = [];

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(address.address)) {
        return address.address;
      }
      fallback.push(address.address);
    }
  }

  return fallback[0] || null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stringifyForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function deleteMobileShareItem(id) {
  const item = mobileShareItems.get(id);
  if (!item) return;
  clearTimeout(item.expireTimer);
  clearTimeout(item.openedExpireTimer);
  mobileShareItems.delete(id);
}

function scheduleMobileShareExpiry(id, delay) {
  const item = mobileShareItems.get(id);
  if (!item) return null;

  return setTimeout(() => {
    deleteMobileShareItem(id);
  }, delay);
}

function getMobileShareIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.match(/^\/share\/([A-Za-z0-9_-]{32,96})$/)?.[1] || null;
  } catch {
    return null;
  }
}

function createMobileSharePage(item) {
  const nonce = crypto.randomBytes(16).toString("base64");
  const title = item.title || "Monapad Note";
  const labels = {
    copy: item.labels?.copy || "Copy",
    copied: item.labels?.copied || "Copied!",
  };
  const payload = stringifyForInlineScript({ title, text: item.text });

  return {
    nonce,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      min-height: 100vh;
      padding: 18px 16px 88px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a {
      color: #fff;
      text-decoration: underline;
      text-underline-offset: 0.14em;
    }
    .actions {
      position: fixed;
      right: 14px;
      bottom: 0;
      display: flex;
      padding: 0 0 calc(14px + env(safe-area-inset-bottom));
    }
    button {
      min-width: 96px;
      min-height: 42px;
      padding: 0 18px;
      border: 1px solid #18181a;
      border-radius: 21px;
      background: #18181a;
      color: #fff;
      font: inherit;
    }
  </style>
</head>
<body>
  <main>
    <pre id="note"></pre>
  </main>
  <div class="actions">
    <button id="copy" type="button">${escapeHtml(labels.copy)}</button>
  </div>
  <script nonce="${nonce}">
    const data = ${payload};
    const labels = ${stringifyForInlineScript(labels)};
    const note = document.getElementById("note");
    const copyButton = document.getElementById("copy");

    function isSafeHttpUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }

    function appendLinkedText(container, text) {
      const urlPattern = /https?:\\/\\/[^\\s<>"']+/g;
      let lastIndex = 0;
      for (const match of text.matchAll(urlPattern)) {
        const urlText = match[0];
        const index = match.index || 0;
        if (index > lastIndex) {
          container.appendChild(document.createTextNode(text.slice(lastIndex, index)));
        }
        if (isSafeHttpUrl(urlText)) {
          const link = document.createElement("a");
          link.href = urlText;
          link.textContent = urlText;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          container.appendChild(link);
        } else {
          container.appendChild(document.createTextNode(urlText));
        }
        lastIndex = index + urlText.length;
      }
      if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
    }

    appendLinkedText(note, data.text);

    async function copyText() {
      try {
        await navigator.clipboard.writeText(data.text);
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(note);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("copy");
        selection.removeAllRanges();
      }
      copyButton.textContent = labels.copied;
      setTimeout(() => {
        copyButton.textContent = labels.copy;
      }, 1200);
    }

    copyButton.addEventListener("click", copyText);
  </script>
</body>
</html>`,
  };
}

function serveMobileShareRequest(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const match = requestUrl.pathname.match(/^\/share\/([A-Za-z0-9_-]{32,96})$/);

    if (req.method !== "GET" || !match) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
      res.end("Not found");
      return;
    }

    const id = match[1];
    const item = mobileShareItems.get(id);

    if (!item || Date.now() > item.expiresAt) {
      deleteMobileShareItem(id);
      res.writeHead(410, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end("This temporary note link has expired.");
      return;
    }

    if (!item.openedAt) {
      item.openedAt = Date.now();
      item.expiresAt = item.openedAt + MOBILE_SHARE_OPENED_TTL_MS;
      clearTimeout(item.expireTimer);
      item.expireTimer = scheduleMobileShareExpiry(id, MOBILE_SHARE_OPENED_TTL_MS);
    }

    const page = createMobileSharePage(item);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${page.nonce}'; style-src 'nonce-${page.nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    res.end(page.html);
  } catch (error) {
    log.error("mobile share request failed:", error);
    res.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end("Internal server error");
  }
}

function ensureMobileShareServer() {
  if (mobileShareServer?.listening && mobileShareHost && mobileSharePort) {
    return Promise.resolve({ host: mobileShareHost, port: mobileSharePort });
  }
  if (mobileShareStartPromise) return mobileShareStartPromise;

  mobileShareStartPromise = new Promise((resolve, reject) => {
    const host = getLanIPv4Address();
    if (!host) {
      mobileShareStartPromise = null;
      reject(new Error("No LAN IPv4 address is available."));
      return;
    }

    const server = http.createServer(serveMobileShareRequest);
    server.keepAliveTimeout = 5000;
    server.headersTimeout = 7000;
    server.maxHeadersCount = 32;

    server.on("clientError", (error, socket) => {
      if (error.code === "HPE_INVALID_METHOD" || error.message.includes("Invalid method")) {
        log.info("mobile share received HTTPS traffic on the HTTP share link. Use the displayed http:// URL.");
      } else {
        log.warn("mobile share client error:", error.message);
      }
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    });

    server.once("error", (error) => {
      mobileShareStartPromise = null;
      reject(error);
    });

    server.listen(0, host, () => {
      mobileShareServer = server;
      mobileShareHost = host;
      mobileSharePort = server.address().port;
      mobileShareStartPromise = null;
      resolve({ host: mobileShareHost, port: mobileSharePort });
    });
  });

  return mobileShareStartPromise;
}

ipcMain.handle("file:unwatch", (event, filePath) => {
  const refCount = watcherRefCounts.get(filePath) || 0;
  if (refCount > 1) {
    watcherRefCounts.set(filePath, refCount - 1);
    return;
  }

  const watcher = watchers.get(filePath);
  if (watcher) {
    if (typeof watcher.close === "function") {
      watcher.close();
    } else {
      watcher.fileWatcher?.close();
      watcher.dirWatcher?.close();
    }
    watchers.delete(filePath);
  }

  watcherRefCounts.delete(filePath);

  // clear pending debounce timeout
  const timeout = watchTimeouts.get(filePath);
  if (timeout) {
    clearTimeout(timeout);
    watchTimeouts.delete(filePath);
  }

  // clear merged event state
  watchEvents.delete(filePath);
});

ipcMain.handle("open-path", async (event, path) => {
  try {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      // open inside folder if folder path
      await shell.openPath(path);
    } else {
      // open parent folder if file path
      await shell.showItemInFolder(path);
    }
  } catch (error) {
    log.error("Failed to open path:", error);
  }
});

ipcMain.handle("mobile-share:create", async (event, payload) => {
  const text = typeof payload?.text === "string" ? payload.text : "";
  const title = typeof payload?.title === "string" && payload.title.trim() ? payload.title.trim() : "Monapad Note";
  const labels = payload?.labels && typeof payload.labels === "object" ? payload.labels : {};
  const textBytes = Buffer.byteLength(text, "utf8");

  if (textBytes > MOBILE_SHARE_MAX_TEXT_BYTES) {
    return {
      success: false,
      errorKey: "tooLarge",
      maxMb: Math.floor(MOBILE_SHARE_MAX_TEXT_BYTES / 1024 / 1024),
    };
  }

  try {
    const { host, port } = await ensureMobileShareServer();
    const id = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + MOBILE_SHARE_CREATED_TTL_MS;
    const expireTimer = setTimeout(() => {
      deleteMobileShareItem(id);
    }, MOBILE_SHARE_CREATED_TTL_MS);

    mobileShareItems.set(id, {
      id,
      title: title.slice(0, 160),
      text,
      labels: {
        copy: typeof labels.copy === "string" ? labels.copy.slice(0, 40) : "Copy",
        copied: typeof labels.copied === "string" ? labels.copied.slice(0, 40) : "Copied!",
      },
      createdAt: Date.now(),
      expiresAt,
      expireTimer,
      openedExpireTimer: null,
      openedAt: null,
    });

    return {
      success: true,
      url: `http://${host}:${port}/share/${id}`,
      expiresAt,
      expiresInMs: MOBILE_SHARE_CREATED_TTL_MS,
      openedExpiresInMs: MOBILE_SHARE_OPENED_TTL_MS,
    };
  } catch (error) {
    log.error("mobile share create failed:", error);
    return { success: false, errorKey: "createError" };
  }
});

ipcMain.handle("mobile-share:revoke", async (event, url) => {
  const id = getMobileShareIdFromUrl(url);
  if (id) deleteMobileShareItem(id);
  return { success: Boolean(id) };
});

ipcMain.handle("mobile-share:status", async (event, url) => {
  const id = getMobileShareIdFromUrl(url);
  if (!id) return { exists: false, expired: true };

  const item = mobileShareItems.get(id);
  if (!item || Date.now() > item.expiresAt) {
    deleteMobileShareItem(id);
    return { exists: false, expired: true };
  }

  return {
    exists: true,
    expired: false,
    opened: Boolean(item.openedAt),
    expiresAt: item.expiresAt,
  };
});

// font
ipcMain.handle("get-fonts", async () => {
  try {
    const fonts = await getFonts();
    return fonts;
  } catch (err) {
    return [];
  }
});

// kuromoji tokenizer
function getKuromojiTokenizer() {
  if (kuromojiTokenizer) return Promise.resolve(kuromojiTokenizer);
  if (kuromojiInitPromise) return kuromojiInitPromise;

  kuromojiInitPromise = new Promise((resolve) => {
    const dicPath = app.isPackaged
      ? path.join(process.resourcesPath, "kuromoji/dict")
      : path.join(__dirname, "../node_modules/kuromoji/dict");
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) {
        log.error("kuromoji init failed:", err);
        kuromojiInitPromise = null;
        resolve(null);
      } else {
        kuromojiTokenizer = tokenizer;
        log.info("kuromoji ready");
        resolve(tokenizer);
      }
    });
  });
  return kuromojiInitPromise;
}

ipcMain.handle("kuromoji:tokenize", async (_, text) => {
  const tokenizer = await getKuromojiTokenizer();
  if (!tokenizer) return null;
  return tokenizer.tokenize(text).map((t) => t.surface_form);
});

// window controls
ipcMain.on("window:minimize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.minimize();
});

ipcMain.on("window:toggleMaximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.isMaximized() ? window.unmaximize() : window.maximize();
    setImmediate(() => sendWindowMaximizeState(window));
  }
});

ipcMain.handle("window:isMaximized", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return Boolean(window?.isMaximized());
});

ipcMain.on("window:setTitleBarOverlay", (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  setWindowTitleBarOverlay(window, options);
});

// call window close from toolbar button
ipcMain.on("window:close", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.destroy();
});

// print
// ipcMain.on("print-content", async (event, { text, fontFamily }) => {
//   const escapeHTML = (str) =>
//     str
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;")
//       .replace(/"/g, "&quot;")
//       .replace(/'/g, "&#39;");

//   const html = `
//     <html>
//       <body>
//         <pre style="
//             font-family: ${fontFamily};
//             white-space: pre-wrap;
//             word-wrap: break-word;
//             max-width: 100%;
//             box-sizing: border-box;
//             padding: 1in;
//         ">
//         ${escapeHTML(text)}
//         </pre>
//       </body>
//     </html>
//   `;

//   const printWindow = new BrowserWindow({
//     show: true,
//     transparent: false,
//     frame: false,
//     webPreferences: { nodeIntegration: true, contextIsolation: false },
//   });

//   await printWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);

//   printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
//     if (!success) {
//       log.error("[main] print failed:", failureReason);
//     }
//     printWindow.close();
//   });
// });

function getFilePathFromArgv(argv) {
  log.info("Debug: process.argv =", argv);

  for (let i = 1; i < argv.length; i++) {
    let arg = argv[i];
    log.info(`Debug: checking arg[${i}] =`, arg);

    if (!arg || arg.startsWith("--")) continue;

    // remove quote
    arg = arg.replace(/^["']|["']$/g, "");

    try {
      const resolved = path.resolve(arg);
      const stat = fs.statSync(resolved);

      // - not parameter
      // - doesn't end with .exe nor .app
      // - path exists
      // - has extension
      if (
        stat.isFile() &&
        !arg.endsWith(".exe") &&
        !arg.endsWith(".app") &&
        (path.extname(arg) || // with extension
          path.basename(arg).startsWith(".")) // allow hidden files like .env
      ) {
        log.info("Debug: Found valid file path:", resolved);
        return resolved;
      }
    } catch (err) {
      log.warn(`Debug: fs.statSync failed for ${arg}`, err.message);
    }
  }

  log.info("Debug: No valid file path found");
  return null;
}

// Handle file association
if (!gotTheLock) {
  app.quit();
} else {
  // Handle second instance (when file is double-clicked while app is running)
  app.on("second-instance", (event, argv, workingDirectory) => {
    log.info("Debug: second-instance triggered with argv:", argv);

    const filePath = getFilePathFromArgv(argv);
    if (filePath) {
      log.info("Debug: Opening file in existing instance:", filePath);

      // Focus existing window
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const win = windows[0];
        if (win.isMinimized()) win.restore();
        win.focus();
        win.webContents.send("open-file", filePath);
      }
    } else {
      // No file to open, just focus the window
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const win = windows[0];
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    }
  });

  app.whenReady().then(() => {
    // create theme folder if not exist
    const userThemesPath = path.join(app.getPath("userData"), "themes");
    if (!fs.existsSync(userThemesPath)) {
      fs.mkdirSync(userThemesPath, { recursive: true });
      console.log("[INIT] Created themes folder:", userThemesPath);
    }
    rotateAutosaveTrash()
      .then(() => cleanupAutosaveStorage())
      .catch((error) => log.warn("[autosave] init failed:", error.message));
    cleanupEmptyNotes().catch((error) => log.warn("[notes] cleanup failed:", error.message));

    createWindow();

    // Handle file opened on app start
    filePathToOpen = getFilePathFromArgv(process.argv);

    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.send("assign-window-id", mainWindow.id);
      if (filePathToOpen) {
        log.info("Sending open-file event to renderer");
        mainWindow.webContents.send("open-file", filePathToOpen);
        filePathToOpen = null;
      }
    });

    // Updater
    if (autoUpdater) {
      autoUpdater.checkForUpdates();

      autoUpdater.on("update-downloaded", async () => {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: "info",
          buttons: ["Restart now", "Later"],
          defaultId: 0,
          cancelId: 1,
          title: "Update Ready",
          message: "A new version has been downloaded. Restart the app now to apply the update?",
        });
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    for (const id of mobileShareItems.keys()) {
      deleteMobileShareItem(id);
    }
    if (mobileShareServer) {
      mobileShareServer.close();
      mobileShareServer = null;
      mobileShareHost = null;
      mobileSharePort = null;
    }
  });

  // Handle macOS file opening
  app.on("open-file", (event, path) => {
    event.preventDefault();
    log.info("Debug: macOS open-file event triggered with path:", path);

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("open-file", path);
    } else {
      // If no windows exist, store the file path and open it after window creation
      app.whenReady().then(() => {
        createWindow();
        mainWindow.webContents.once("did-finish-load", () => {
          mainWindow.webContents.send("assign-window-id", mainWindow.id);
          mainWindow.webContents.send("open-file", path);
        });
      });
    }
  });
}
