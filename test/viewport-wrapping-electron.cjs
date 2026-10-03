const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const output = process.argv[2];
app.setPath("userData", path.join(output, "profile"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 900,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
  const errors = [];
  win.webContents.on("console-message", event => { if (event.level === "error") errors.push(event.message); });
  await win.loadFile(path.join(output, "index.html"));
  try {
    const results = await win.webContents.executeJavaScript("runChecks()", true);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("PASS viewport wrapping: native equivalence, bounded measurements, scroll, folding, undo, options, model replacement");
    console.log(JSON.stringify(results));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
}).catch(error => { console.error(error); app.exit(1); });
