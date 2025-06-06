const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { getFonts } = require("font-list");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store").default;
const log = require("electron-log");

const store = new Store();
const watchers = new Map();
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let filePathToOpen = null;

function createWindow() {
  const windowBounds = store.get("windowBounds") || { width: 800, height: 600 };

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 400,
    minHeight: 210,
    frame: false,
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

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => {
    const { width, height } = mainWindow.getBounds();
    store.set("windowBounds", { width, height });
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
}

function createNewWindow() {
  const windowBounds = store.get("windowBounds") || { width: 800, height: 600 };

  const win = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 400,
    minHeight: 210,
    frame: false,
    transparent: true,
    vibrancy: "acrylic",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    center: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, "icon/favicon.ico"),
  });

  win.loadFile("index.html");

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("resize", () => {
    const { width, height } = win.getBounds();
    store.set("windowBounds", { width, height });
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
}

// app version
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// File operations, window control handler
ipcMain.handle("window:createNew", createNewWindow);

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ["openFile"] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("dialog:saveFile", async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: defaultName });
  return canceled || !filePath ? {} : { filePath };
});

ipcMain.handle("file:save", async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("file:read", async (event, filePath) => {
  try {
    return await fs.promises.readFile(filePath, "utf8");
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

ipcMain.handle("file:watch", (event, filePath) => {
  if (watchers.has(filePath)) return;
  try {
    const watcher = fs.watch(filePath, (eventType) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("file:changed", { filePath, eventType });
      });
    });
    watchers.set(filePath, watcher);
  } catch (err) {
    log.error("watch error:", err);
  }
});

ipcMain.handle("file:unwatch", (event, filePath) => {
  const watcher = watchers.get(filePath);
  if (watcher) {
    watcher.close();
    watchers.delete(filePath);
  }
});

ipcMain.handle("open-path", async (event, path) => {
  try {
    await shell.showItemInFolder(path);
  } catch (error) {
    log.error("Failed to open path:", error);
  }
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

// window controls
ipcMain.on("window:minimize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.minimize();
});

ipcMain.on("window:toggleMaximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.isMaximized() ? window.unmaximize() : window.maximize();
  }
});

ipcMain.on("window:close", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.close();
});

// print
ipcMain.on("print-content", async (event, { text, fontFamily }) => {
  const escapeHTML = (str) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const html = `
    <html>
      <body>
        <pre style="
            font-family: ${fontFamily};
            white-space: pre-wrap;
            word-wrap: break-word;
            max-width: 100%;
            box-sizing: border-box;
            padding: 1in;
        ">
        ${escapeHTML(text)}
        </pre>
      </body>
    </html>
  `;

  const printWindow = new BrowserWindow({
    show: true,
    transparent: true,
    frame: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  await printWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);

  printWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
    if (!success) {
      log.error("[main] print failed:", failureReason);
    }
    printWindow.close();
  });
});

function getFilePathFromArgv(argv) {
  log.info("Debug: process.argv =", argv);

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    log.info(`Debug: checking arg[${i}] =`, arg);

    // - not parameter
    // - doesn't end with .exe nor .app
    // - path exists
    // - has extension
    if (
      arg &&
      !arg.startsWith("--") &&
      !arg.endsWith(".exe") &&
      !arg.endsWith(".app") &&
      fs.existsSync(arg) &&
      path.extname(arg)
    ) {
      log.info("Debug: Found valid file path:", arg);
      return path.resolve(arg);
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
    createWindow();

    // Handle file opened on app start
    filePathToOpen = getFilePathFromArgv(process.argv);

    mainWindow.webContents.once("did-finish-load", () => {
      if (filePathToOpen) {
        log.info("Sending open-file event to renderer");
        mainWindow.webContents.send("open-file", filePathToOpen);
        filePathToOpen = null;
      }
    });

    // Auto updater (optional)
    if (autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
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
          mainWindow.webContents.send("open-file", path);
        });
      });
    }
  });
}
