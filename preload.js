const { contextBridge, ipcRenderer, webUtils, shell } = require("electron");
const fs = require("fs");
const log = require("electron-log");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  openExternal: (url) => shell.openExternal(url),
  sendMessage: (msg) => ipcRenderer.send("message", msg),
  onReceive: (callback) => ipcRenderer.on("reply", callback),
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  saveToFile: (filePath, content) => ipcRenderer.invoke("file:save", filePath, content),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("dialog:saveFile", defaultName),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
  createNewWindow: () => ipcRenderer.invoke("window:createNew"),
  fileExists: (filePath) => ipcRenderer.invoke("file:exists", filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openPath: (path) => ipcRenderer.invoke("open-path", path),

  // file watch
  watchFile: (filePath) => ipcRenderer.invoke("file:watch", filePath),
  unwatchFile: (filePath) => ipcRenderer.invoke("file:unwatch", filePath),
  onFileChanged: (callback) => ipcRenderer.on("file:changed", callback),

  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggleMaximize"),
  closeWindow: () => ipcRenderer.send("window:close"),

  printContent: (text) => ipcRenderer.send("print-content", text),

  // font
  getFonts: () => ipcRenderer.invoke("get-fonts"),

  onOpenFile: (cb) => ipcRenderer.on("open-file", (_, path) => cb(path)),
  removeOpenFileListener: () => ipcRenderer.removeAllListeners("open-file"),
});

contextBridge.exposeInMainWorld("electronLog", {
  info: (...args) => log.info(...args),
  error: (...args) => log.error(...args),
  warn: (...args) => log.warn(...args),
});
