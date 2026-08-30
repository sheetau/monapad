const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse, printParseErrorCode } = require("jsonc-parser");

const VSCODE_THEME_PATHS_FILE = "vscode-theme-paths.txt";
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_THEME_BYTES = 10 * 1024 * 1024;
const MAX_INCLUDE_DEPTH = 16;

function getDefaultVSCodeExtensionRoots(homeDir = os.homedir(), env = process.env, platform = process.platform) {
  const roots = [
    path.join(homeDir, ".vscode", "extensions"),
    path.join(homeDir, ".vscode-insiders", "extensions"),
    path.join(homeDir, ".vscode-oss", "extensions"),
  ];
  if (env.VSCODE_PORTABLE) roots.push(path.join(env.VSCODE_PORTABLE, "data", "extensions"));
  if (platform === "win32") {
    for (const baseDir of [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs"), env.ProgramFiles, env["ProgramFiles(x86)"]].filter(Boolean)) {
      roots.push(
        path.join(baseDir, "Microsoft VS Code", "resources", "app", "extensions"),
        path.join(baseDir, "Microsoft VS Code Insiders", "resources", "app", "extensions"),
        path.join(baseDir, "VSCodium", "resources", "app", "extensions"),
      );
    }
  } else if (platform === "darwin") {
    roots.push(
      "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions",
      "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/extensions",
      "/Applications/VSCodium.app/Contents/Resources/app/extensions",
      path.join(homeDir, "Applications", "Visual Studio Code.app", "Contents", "Resources", "app", "extensions"),
    );
  } else {
    roots.push(
      "/usr/share/code/resources/app/extensions",
      "/usr/lib/code/resources/app/extensions",
      "/usr/share/codium/resources/app/extensions",
      "/opt/visual-studio-code/resources/app/extensions",
      "/snap/code/current/usr/share/code/resources/app/extensions",
    );
  }
  return roots;
}

function createVSCodeThemePathsFileContent(roots) {
  return [
    "# Monapad VS Code theme extension folders",
    "# One absolute folder path per line. Lines beginning with # are ignored.",
    "# Restart Monapad after editing this file.",
    "",
    ...roots,
    "",
  ].join(os.EOL);
}

async function ensureVSCodeThemePathsFile(themesDir, options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const env = options.env || process.env;
  const configPath = path.join(themesDir, VSCODE_THEME_PATHS_FILE);
  await fs.promises.mkdir(themesDir, { recursive: true });
  try {
    await fs.promises.writeFile(
      configPath,
      createVSCodeThemePathsFileContent(getDefaultVSCodeExtensionRoots(homeDir, env)),
      { encoding: "utf8", flag: "wx" },
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return configPath;
}

function expandThemePath(value, homeDir, env) {
  let expanded = value.trim().replace(/^['"]|['"]$/g, "");
  expanded = expanded.replace(/%([^%]+)%/g, (match, name) => env[name] || env[name.toUpperCase()] || match);
  if (expanded === "~") expanded = homeDir;
  else if (expanded.startsWith(`~${path.sep}`) || expanded.startsWith("~/") || expanded.startsWith("~\\")) {
    expanded = path.join(homeDir, expanded.slice(2));
  }
  return path.resolve(expanded);
}

function parseVSCodeThemePaths(content, options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const env = options.env || process.env;
  const seen = new Set();
  const roots = [];
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const root = expandThemePath(line, homeDir, env);
    const key = process.platform === "win32" ? root.toLowerCase() : root;
    if (!seen.has(key)) {
      seen.add(key);
      roots.push(root);
    }
  }
  return roots;
}

async function readJsoncFile(filePath, maximumBytes) {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile() || stats.size > maximumBytes) throw new Error(`Theme file is too large: ${filePath}`);
  const source = await fs.promises.readFile(filePath, "utf8");
  const errors = [];
  const value = parse(source, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0 || !value || typeof value !== "object") {
    const detail = errors.map((error) => printParseErrorCode(error.error)).join(", ") || "invalid root";
    throw new Error(`Invalid JSONC (${detail}): ${filePath}`);
  }
  return value;
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function compareVersions(left, right) {
  return String(left || "0").localeCompare(String(right || "0"), undefined, { numeric: true, sensitivity: "base" });
}

async function readExtensionPackage(extensionDir) {
  try {
    const manifest = await readJsoncFile(path.join(extensionDir, "package.json"), MAX_PACKAGE_BYTES);
    const contributedThemes = Array.isArray(manifest.contributes?.themes) ? manifest.contributes.themes : [];
    if (contributedThemes.length === 0) return null;
    const extensionId = [manifest.publisher, manifest.name].filter(Boolean).join(".") || path.basename(extensionDir);
    return {
      extensionDir,
      extensionId,
      extensionName: manifest.displayName || manifest.name || extensionId,
      version: manifest.version || "0",
      contributedThemes,
    };
  } catch {
    return null;
  }
}

async function discoverVSCodeThemes(themesDir, options = {}) {
  const configPath = await ensureVSCodeThemePathsFile(themesDir, options);
  const configContent = await fs.promises.readFile(configPath, "utf8");
  const roots = parseVSCodeThemePaths(configContent, options);
  const packages = [];

  for (const root of roots) {
    const directPackage = await readExtensionPackage(root);
    if (directPackage) {
      packages.push(directPackage);
      continue;
    }
    let entries = [];
    try {
      entries = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    const found = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => readExtensionPackage(path.join(root, entry.name))),
    );
    packages.push(...found.filter(Boolean));
  }

  const latestPackages = new Map();
  for (const extensionPackage of packages) {
    const existing = latestPackages.get(extensionPackage.extensionId);
    if (!existing || compareVersions(existing.version, extensionPackage.version) < 0) {
      latestPackages.set(extensionPackage.extensionId, extensionPackage);
    }
  }

  const records = new Map();
  for (const extensionPackage of latestPackages.values()) {
    let extensionDir;
    try {
      extensionDir = await fs.promises.realpath(extensionPackage.extensionDir);
    } catch {
      continue;
    }
    for (const contribution of extensionPackage.contributedThemes) {
      if (!contribution || typeof contribution.path !== "string") continue;
      let themePath;
      try {
        themePath = await fs.promises.realpath(path.resolve(extensionDir, contribution.path));
        if (!isPathInside(extensionDir, themePath) || !/\.jsonc?$/i.test(themePath)) continue;
        const stats = await fs.promises.stat(themePath);
        if (!stats.isFile() || stats.size > MAX_THEME_BYTES) continue;
      } catch {
        continue;
      }

      const contributionId = contribution.id || contribution.label || path.basename(themePath);
      const key = `${extensionPackage.extensionId}\0${contributionId}`;
      const id = `vscode:${crypto.createHash("sha256").update(key).digest("base64url").slice(0, 22)}`;
      records.set(id, {
        id,
        label: contribution.label || contribution.id || path.basename(themePath, path.extname(themePath)),
        extensionId: extensionPackage.extensionId,
        extensionName: extensionPackage.extensionName,
        uiTheme: contribution.uiTheme || "vs-dark",
        themePath,
        extensionDir,
      });
    }
  }

  const themes = [...records.values()].sort(
    (left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }) ||
      left.extensionName.localeCompare(right.extensionName, undefined, { sensitivity: "base" }),
  );
  return { configPath, roots, themes, records };
}

async function loadThemeFile(filePath, extensionDir, visited, depth) {
  if (depth > MAX_INCLUDE_DEPTH) throw new Error("VS Code theme include depth exceeded.");
  const resolvedPath = await fs.promises.realpath(path.resolve(filePath));
  if (!isPathInside(extensionDir, resolvedPath)) throw new Error("VS Code theme include escaped its extension folder.");
  if (visited.has(resolvedPath)) throw new Error("VS Code theme include cycle detected.");
  visited.add(resolvedPath);

  try {
    const current = await readJsoncFile(resolvedPath, MAX_THEME_BYTES);
    let base = {};
    if (typeof current.include === "string") {
      base = await loadThemeFile(path.resolve(path.dirname(resolvedPath), current.include), extensionDir, visited, depth + 1);
    }
    return {
      ...base,
      ...current,
      colors: { ...(base.colors || {}), ...(current.colors || {}) },
      tokenColors: [...(Array.isArray(base.tokenColors) ? base.tokenColors : []), ...(Array.isArray(current.tokenColors) ? current.tokenColors : [])],
      semanticTokenColors: { ...(base.semanticTokenColors || {}), ...(current.semanticTokenColors || {}) },
    };
  } finally {
    visited.delete(resolvedPath);
  }
}

async function loadVSCodeTheme(record) {
  if (!record) throw new Error("Unknown VS Code theme.");
  const theme = await loadThemeFile(record.themePath, record.extensionDir, new Set(), 0);
  return {
    id: record.id,
    label: record.label,
    extensionId: record.extensionId,
    extensionName: record.extensionName,
    uiTheme: record.uiTheme,
    type: theme.type,
    colors: theme.colors || {},
    tokenColors: Array.isArray(theme.tokenColors) ? theme.tokenColors : [],
    semanticTokenColors: theme.semanticTokenColors || {},
  };
}

module.exports = {
  VSCODE_THEME_PATHS_FILE,
  createVSCodeThemePathsFileContent,
  discoverVSCodeThemes,
  ensureVSCodeThemePathsFile,
  getDefaultVSCodeExtensionRoots,
  isPathInside,
  loadVSCodeTheme,
  parseVSCodeThemePaths,
};
