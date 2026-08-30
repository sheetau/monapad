const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  VSCODE_THEME_PATHS_FILE,
  discoverVSCodeThemes,
  ensureVSCodeThemePathsFile,
  getDefaultVSCodeExtensionRoots,
  loadVSCodeTheme,
  parseVSCodeThemePaths,
} = require("../src/vscode-theme-loader");

async function writeFile(targetPath, content) {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, content, "utf8");
}

test("includes user, portable, and installed VS Code extension roots", () => {
  const roots = getDefaultVSCodeExtensionRoots("C:\\Users\\sample", {
    LOCALAPPDATA: "C:\\Users\\sample\\AppData\\Local",
    ProgramFiles: "C:\\Program Files",
    VSCODE_PORTABLE: "D:\\VSCode",
  }, "win32");
  assert.ok(roots.some((root) => root.endsWith(path.join(".vscode", "extensions"))));
  assert.ok(roots.includes(path.join("D:\\VSCode", "data", "extensions")));
  assert.ok(roots.includes(path.join("C:\\Program Files", "Microsoft VS Code", "resources", "app", "extensions")));
});

test("creates an editable path file once and expands configured paths", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "monapad-vscode-theme-paths-"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const themesDir = path.join(root, "themes");
  const configPath = await ensureVSCodeThemePathsFile(themesDir, { homeDir: path.join(root, "home"), env: {} });
  const initial = await fs.promises.readFile(configPath, "utf8");
  assert.match(initial, /\.vscode[\\/]extensions/);

  await fs.promises.writeFile(configPath, "# custom\n%TEST_ROOT%/extensions\n~/extra\n", "utf8");
  await ensureVSCodeThemePathsFile(themesDir, { homeDir: path.join(root, "home"), env: { TEST_ROOT: root } });
  assert.equal(await fs.promises.readFile(configPath, "utf8"), "# custom\n%TEST_ROOT%/extensions\n~/extra\n");
  assert.deepEqual(
    parseVSCodeThemePaths(await fs.promises.readFile(configPath, "utf8"), {
      homeDir: path.join(root, "home"),
      env: { TEST_ROOT: root },
    }),
    [path.resolve(root, "extensions"), path.resolve(root, "home", "extra")],
  );
});

test("discovers the newest extension theme, rejects escaped paths, and merges JSONC includes", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "monapad-vscode-theme-loader-"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const themesDir = path.join(root, "themes");
  const extensionsDir = path.join(root, "extensions");
  const oldExtension = path.join(extensionsDir, "sample.theme-1.9.0");
  const newExtension = path.join(extensionsDir, "sample.theme-1.10.0");

  await writeFile(
    path.join(oldExtension, "package.json"),
    JSON.stringify({ publisher: "sample", name: "theme", version: "1.9.0", contributes: { themes: [{ label: "Old", path: "./old.json" }] } }),
  );
  await writeFile(path.join(oldExtension, "old.json"), JSON.stringify({ colors: { "editor.background": "#000000" } }));
  await writeFile(
    path.join(newExtension, "package.json"),
    JSON.stringify({
      publisher: "sample",
      name: "theme",
      displayName: "Sample Theme",
      version: "1.10.0",
      contributes: {
        themes: [
          { id: "sample-dark", label: "Sample Dark", uiTheme: "vs-dark", path: "./theme.json" },
          { id: "escaped", label: "Escaped", uiTheme: "vs-dark", path: "../outside.json" },
        ],
      },
    }),
  );
  await writeFile(
    path.join(newExtension, "base.json"),
    '{ // comment\n "colors": { "editor.background": "#101010", }, "tokenColors": [{ "scope": "comment", "settings": { "foreground": "#777777" } }] }',
  );
  await writeFile(
    path.join(newExtension, "theme.json"),
    '{ "include": "./base.json", "colors": { "editor.foreground": "#eeeeee" }, "tokenColors": [{ "scope": "string", "settings": { "foreground": "#00aa00" } }] }',
  );
  await writeFile(path.join(extensionsDir, "outside.json"), JSON.stringify({ colors: {} }));
  await writeFile(path.join(themesDir, VSCODE_THEME_PATHS_FILE), `${extensionsDir}\n`);

  const catalog = await discoverVSCodeThemes(themesDir);
  assert.equal(catalog.themes.length, 1);
  assert.equal(catalog.themes[0].label, "Sample Dark");
  assert.equal(catalog.themes[0].extensionName, "Sample Theme");

  const theme = await loadVSCodeTheme(catalog.records.get(catalog.themes[0].id));
  assert.equal(theme.colors["editor.background"], "#101010");
  assert.equal(theme.colors["editor.foreground"], "#eeeeee");
  assert.deepEqual(theme.tokenColors.map((rule) => rule.scope), ["comment", "string"]);

  await writeFile(path.join(themesDir, VSCODE_THEME_PATHS_FILE), `${newExtension}\n`);
  const directCatalog = await discoverVSCodeThemes(themesDir);
  assert.equal(directCatalog.themes.length, 1);
  assert.equal(directCatalog.themes[0].label, "Sample Dark");
});

test("rejects a theme include that escapes its extension folder", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "monapad-vscode-theme-escape-"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const themesDir = path.join(root, "themes");
  const extensionsDir = path.join(root, "extensions");
  const extensionDir = path.join(extensionsDir, "sample.escape-1.0.0");
  await writeFile(
    path.join(extensionDir, "package.json"),
    JSON.stringify({ publisher: "sample", name: "escape", version: "1.0.0", contributes: { themes: [{ label: "Escape", path: "./theme.json" }] } }),
  );
  await writeFile(path.join(extensionDir, "theme.json"), '{ "include": "../outside.json" }');
  await writeFile(path.join(extensionsDir, "outside.json"), "{}");
  await writeFile(path.join(themesDir, VSCODE_THEME_PATHS_FILE), `${extensionsDir}\n`);
  const catalog = await discoverVSCodeThemes(themesDir);
  await assert.rejects(() => loadVSCodeTheme(catalog.records.get(catalog.themes[0].id)), /escaped/);
});
