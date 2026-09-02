const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const i18nextSource = fs.readFileSync(path.join(__dirname, "..", "src", "i18next.js"), "utf8");

function getRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

test("Monaco hover keeps the established viewport compensation", () => {
  assert.match(getRule(".monaco-hover.workbench-hover"), /bottom:\s*-33px\s*!important/);
  assert.match(getRule(".monaco-hover.workbench-hover"), /transform:\s*translateX/);
});

test("gutter background does not make the editor a tooltip containing block", () => {
  assert.doesNotMatch(getRule("#editor"), /position:\s*(?:relative|absolute|fixed|sticky)/);
  assert.match(getRule("#editor::before"), /position:\s*fixed/);
  assert.match(getRule("#editor::before"), /left:\s*var\(--editor-side-panel-offset\)/);
});

test("warned tabs strike only the title without overriding state opacity", () => {
  assert.doesNotMatch(getRule(".tab .name.warn"), /text-decoration/);
  assert.match(getRule(".tab .name.warn"), /opacity:\s*0\.5/);
  assert.match(getRule(".tab .name.warn .tab-name-label"), /text-decoration:\s*line-through/);
  assert.doesNotMatch(getRule(".tab .name.warn .tab-name-label"), /opacity/);
});

test("tab-path and Kuromoji settings use localized descriptive titles", () => {
  assert.ok(html.indexOf('id="toggleTabPaths"') < html.indexOf('id="toggleKuromoji"'));
  assert.match(i18nextSource, /setTitle\("#toggleTabPaths", t\("settings\.alwaysShowTabPathsTooltip"\)\)/);
  assert.match(i18nextSource, /setTitle\("#toggleKuromoji", t\("settings\.kuromojiTooltip"\)\)/);

  for (const locale of ["en-US", "ja-JP", "de-DE", "pt-BR", "zh-CN"]) {
    const settings = require(`../src/locales/${locale}.json`).settings;
    assert.ok(settings.alwaysShowTabPaths);
    assert.ok(settings.alwaysShowTabPathsTooltip);
    assert.ok(settings.kuromojiTooltip);
  }
});
