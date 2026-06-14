const { contextBridge, ipcRenderer, webUtils, shell } = require("electron");
const log = require("electron-log");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getAppSessionId: () => ipcRenderer.invoke("get-app-session-id"),
  openExternal: (url) => shell.openExternal(url),
  sendMessage: (msg) => ipcRenderer.send("message", msg),
  onReceive: (callback) => ipcRenderer.on("reply", callback),
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  saveToFile: (filePath, content, options) => ipcRenderer.invoke("file:save", filePath, content, options),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("dialog:saveFile", defaultName),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  readFileWithEncoding: (filePath) => ipcRenderer.invoke("file:readWithEncoding", filePath),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
  createNewWindow: () => ipcRenderer.invoke("window:createNew"),

  // === move tab between windows ===
  // open tab in new window
  createNewWindowWithTab: (tabData, position) => ipcRenderer.invoke("window:createNewWithTab", tabData, position),
  // receive tab data on new window
  onLoadTabData: (callback) => ipcRenderer.on("load-tab-data", (event, tabData) => callback(tabData)),
  // external tab drop preview
  onShowExternalDropIndicator: (callback) =>
    ipcRenderer.on("show-external-drop-indicator", (event, payload) => callback(payload)),
  onHideExternalDropIndicator: (callback) => ipcRenderer.on("hide-external-drop-indicator", () => callback()),
  // assign each window id
  onAssignWindowId: (callback) => ipcRenderer.on("assign-window-id", (_, id) => callback(id)),
  // get window id
  getWindowIdAt: (point) => ipcRenderer.invoke("window:getIdAt", point),
  getCursorScreenPoint: () => ipcRenderer.invoke("cursor:getScreenPoint"),
  // get window bounds
  getMyBounds: () => ipcRenderer.invoke("window:getMyBounds"),
  getWindowBounds: (windowId) => ipcRenderer.invoke("window:getBounds", windowId),
  // get if window is minimized or not
  isWindowMinimized: (windowId) => ipcRenderer.invoke("isWindowMinimized", windowId),
  // send tab to different window
  sendTabToWindow: (windowId, tabData) => ipcRenderer.invoke("tab:sendToWindow", windowId, tabData),
  previewTabDrop: (targetWindowId, payload) => ipcRenderer.send("tab:previewDrop", { targetWindowId, ...payload }),
  clearPreviewTabDrop: (targetWindowId) => ipcRenderer.send("tab:clearPreviewDrop", { targetWindowId }),
  // focus window after tab is sent
  focusWindow: (windowId) => ipcRenderer.invoke("focus-window", windowId),
  // small window when dragging tab outside toolbar
  createCursorWindow: () => ipcRenderer.send("createCursorWindow"),
  moveCursorWindow: (x, y) => ipcRenderer.send("moveCursorWindow", { x, y }),
  destroyCursorWindow: () => ipcRenderer.send("destroyCursorWindow"),
  // receive change cursor window text command
  setCursorWindowState: (state) => ipcRenderer.send("setCursorWindowState", state),

  fileExists: (filePath) => ipcRenderer.invoke("file:exists", filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  createMobileShare: (payload) => ipcRenderer.invoke("mobile-share:create", payload),
  revokeMobileShare: (url) => ipcRenderer.invoke("mobile-share:revoke", url),
  getMobileShareStatus: (url) => ipcRenderer.invoke("mobile-share:status", url),
  writeAutosave: (payload) => ipcRenderer.invoke("autosave:write", payload),
  getFileAutosaveBackup: (filePath) => ipcRenderer.invoke("autosave:get-file-backup", filePath),
  discardFileAutosaveBackup: (filePath) => ipcRenderer.invoke("autosave:discard-file-backup", filePath),
  listAutosaveDrafts: (payload) => ipcRenderer.invoke("autosave:list-drafts", payload),
  deleteAutosaveDraft: (draftId) => ipcRenderer.invoke("autosave:delete-draft", draftId),
  moveAutosaveDraftToTrash: (payload) => ipcRenderer.invoke("autosave:move-draft-to-trash", payload),
  readAutosaveTrash: (trashId) => ipcRenderer.invoke("autosave:read-trash", trashId),
  deleteAutosaveTrash: (trashId) => ipcRenderer.invoke("autosave:delete-trash", trashId),
  getAutosaveTrashPreviousPath: () => ipcRenderer.invoke("autosave:get-trash-previous-path"),
  createNote: (payload) => ipcRenderer.invoke("notes:create", payload),
  writeNote: (payload) => ipcRenderer.invoke("notes:write", payload),
  readNote: (noteId) => ipcRenderer.invoke("notes:read", noteId),
  deleteNote: (noteId) => ipcRenderer.invoke("notes:delete", noteId),
  trashNote: (noteId) => ipcRenderer.invoke("notes:trash", noteId),
  duplicateNote: (noteId) => ipcRenderer.invoke("notes:duplicate", noteId),
  updateNoteMeta: (payload) => ipcRenderer.invoke("notes:update-meta", payload),
  reorderNotes: (payload) => ipcRenderer.invoke("notes:reorder", payload),
  moveNoteEntry: (payload) => ipcRenderer.invoke("notes:move-entry", payload),
  noteExists: (noteId) => ipcRenderer.invoke("notes:exists", noteId),
  listNotes: (payload) => ipcRenderer.invoke("notes:list", payload),
  refreshNotesIndex: () => ipcRenderer.invoke("notes:refresh-index"),
  createFolder: (payload) => ipcRenderer.invoke("folders:create", payload),
  renameFolder: (payload) => ipcRenderer.invoke("folders:rename", payload),
  deleteFolder: (folderPath) => ipcRenderer.invoke("folders:delete", folderPath),
  updateFolderMeta: (payload) => ipcRenderer.invoke("folders:update-meta", payload),
  onWindowFocus: (callback) => ipcRenderer.on("window-focus", (event, focused) => callback(focused)),
  onWindowMaximizeState: (callback) => ipcRenderer.on("window-maximize-state", (event, maximized) => callback(maximized)),
  onAttemptCloseWindow: (callback) => ipcRenderer.on("attempt-close-window", callback),

  // file watch
  watchFile: (filePath) => ipcRenderer.invoke("file:watch", filePath),
  unwatchFile: (filePath) => ipcRenderer.invoke("file:unwatch", filePath),
  onFileChanged: (callback) => ipcRenderer.on("file:changed", callback),

  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggleMaximize"),
  isWindowMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  closeWindow: () => ipcRenderer.send("window:close"),
  setTitleBarOverlay: (options) => ipcRenderer.send("window:setTitleBarOverlay", options),

  // printContent: (text) => ipcRenderer.send("print-content", text),

  // font
  getFonts: () => ipcRenderer.invoke("get-fonts"),
  // kuromoji
  tokenize: (text) => ipcRenderer.invoke("kuromoji:tokenize", text),

  // open file on launch
  onOpenFile: (cb) => ipcRenderer.on("open-file", (_, path) => cb(path)),
  removeOpenFileListener: () => ipcRenderer.removeAllListeners("open-file"),

  // theme
  getCustomThemes: () => ipcRenderer.invoke("get-custom-themes"),
  getUserDataPath: () => ipcRenderer.invoke("get-user-data-path"),
  readCssFile: (filePath) => ipcRenderer.invoke("read-css-file", filePath),
  watchCssFile: (filePath) => ipcRenderer.send("watch-css-file", filePath),
  unwatchCssFile: (filePath) => ipcRenderer.send("unwatch-css-file", filePath),
  onCssFileUpdated: (callback) => ipcRenderer.on("css-file-updated", (_, path) => callback(path)),
});

contextBridge.exposeInMainWorld("electronLog", {
  info: (...args) => log.info(...args),
  error: (...args) => log.error(...args),
  warn: (...args) => log.warn(...args),
});
