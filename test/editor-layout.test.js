const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");

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
