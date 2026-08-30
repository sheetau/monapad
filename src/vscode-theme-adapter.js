const VALID_COLOR = /^(?:#[0-9a-f]{3,8}|transparent)$/i;

const UI_COLOR_MAP = {
  "--color1": ["editor.background"],
  "--editor-gutter-background": ["editorGutter.background", "editor.background"],
  "--color2": ["menu.background", "sideBar.background", "titleBar.activeBackground", "editorWidget.background", "editor.background"],
  "--color3": ["list.hoverBackground", "toolbar.hoverBackground", "list.inactiveSelectionBackground", "widget.border"],
  "--editorText": ["editor.foreground", "foreground"],
  "--grayOut": ["descriptionForeground", "disabledForeground", "editorLineNumber.foreground"],
  "--highlight": ["textLink.foreground", "focusBorder", "list.highlightForeground"],
  "--btnHighlight": ["button.background", "focusBorder"],
  "--warn": ["errorForeground", "editorError.foreground"],
};

const SYNTAX_SCOPE_MAP = {
  heading1: ["markup.heading.markdown", "entity.name.section.markdown", "markup.heading"],
  heading2: ["markup.heading.markdown", "entity.name.section.markdown", "markup.heading"],
  heading3: ["markup.heading.markdown", "entity.name.section.markdown", "markup.heading"],
  bulletPoint: ["punctuation.definition.list.begin.markdown", "markup.list"],
  numberList: ["punctuation.definition.list.begin.markdown", "markup.list"],
  subText: ["comment", "punctuation.definition.comment"],
  blockQuote: ["markup.quote.markdown", "markup.quote"],
  inlineCode: ["markup.inline.raw.string.markdown", "markup.inline.raw"],
  codeBlockFence: ["punctuation.definition.markdown", "markup.fenced_code.block.markdown"],
  codeBlock: ["markup.fenced_code.block.markdown", "markup.raw.block.markdown", "string"],
};

function normalizeColor(value) {
  const color = typeof value === "string" ? value.trim() : "";
  return VALID_COLOR.test(color) ? color : null;
}

function getThemeColor(colors, keys, fallback = null) {
  for (const key of keys) {
    const color = normalizeColor(colors?.[key]);
    if (color) return color;
  }
  return fallback;
}

function normalizeScopes(scope) {
  if (Array.isArray(scope)) return scope.flatMap(normalizeScopes);
  return typeof scope === "string" ? scope.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeFontStyle(value) {
  if (typeof value !== "string") return "";
  const styles = value.trim().split(/\s+/).filter(Boolean);
  return styles.every((style) => ["bold", "italic", "underline", "strikethrough"].includes(style))
    ? styles.join(" ")
    : "";
}

function scopeMatches(scope, candidate) {
  return scope === candidate || scope.startsWith(`${candidate}.`) || candidate.startsWith(`${scope}.`);
}

function findTokenStyle(tokenColors, candidates) {
  for (let index = tokenColors.length - 1; index >= 0; index--) {
    const rule = tokenColors[index];
    const scopes = normalizeScopes(rule?.scope);
    if (!scopes.some((scope) => candidates.some((candidate) => scopeMatches(scope, candidate)))) continue;
    const foreground = normalizeColor(rule.settings?.foreground);
    const fontStyle = normalizeFontStyle(rule.settings?.fontStyle);
    if (foreground || fontStyle) return { foreground, fontStyle };
  }
  return null;
}

function createVSCodeThemePresentation(theme) {
  const colors = theme?.colors || {};
  const tokenColors = Array.isArray(theme?.tokenColors) ? theme.tokenColors : [];
  const light = theme?.type === "light" || theme?.uiTheme === "vs" || theme?.uiTheme === "hc-light";
  const cssVariables = light
    ? {
        "--color1": "#ffffff",
        "--color2": "#f3f3f3",
        "--color3": "#e8e8e8",
        "--editorText": "#333333",
        "--grayOut": "#717171",
        "--highlight": "#0066b8",
        "--btnHighlight": "#007acc",
        "--warn": "#d13438",
      }
    : {
        "--color1": "#1e1e1e",
        "--color2": "#252526",
        "--color3": "#2a2d2e",
        "--editorText": "#d4d4d4",
        "--grayOut": "#858585",
        "--highlight": "#4daafc",
        "--btnHighlight": "#007acc",
        "--warn": "#f48771",
      };
  for (const [variable, keys] of Object.entries(UI_COLOR_MAP)) {
    const value = getThemeColor(colors, keys);
    if (value) cssVariables[variable] = value;
  }

  const syntaxFallbacks = {
    heading1: cssVariables["--highlight"],
    heading2: cssVariables["--highlight"],
    heading3: cssVariables["--editorText"],
    bulletPoint: cssVariables["--highlight"],
    numberList: cssVariables["--highlight"],
    subText: cssVariables["--grayOut"],
    blockQuote: cssVariables["--editorText"],
    inlineCode: cssVariables["--warn"],
    codeBlockFence: cssVariables["--grayOut"],
    codeBlock: cssVariables["--editorText"],
  };
  for (const [name, candidates] of Object.entries(SYNTAX_SCOPE_MAP)) {
    const style = findTokenStyle(tokenColors, candidates);
    const foreground = style?.foreground || syntaxFallbacks[name];
    if (foreground) cssVariables[`--${name}`] = foreground;
    if (style?.fontStyle) cssVariables[`--${name}Style`] = style.fontStyle;
  }

  const monacoColors = {};
  for (const [key, value] of Object.entries(colors)) {
    const color = normalizeColor(value);
    if (color) monacoColors[key] = color;
  }
  const monacoRules = [];
  for (const rule of tokenColors) {
    const foreground = normalizeColor(rule?.settings?.foreground)?.replace(/^#/, "");
    const background = normalizeColor(rule?.settings?.background)?.replace(/^#/, "");
    const fontStyle = normalizeFontStyle(rule?.settings?.fontStyle) || undefined;
    for (const token of normalizeScopes(rule?.scope)) {
      monacoRules.push({ token, foreground, background, fontStyle });
    }
  }

  return { cssVariables, monacoBase: light ? "vs" : "vs-dark", monacoColors, monacoRules };
}

module.exports = { createVSCodeThemePresentation, normalizeColor };
