const assert = require("node:assert/strict");
const test = require("node:test");

const { createVSCodeThemePresentation, normalizeColor } = require("../src/vscode-theme-adapter");

test("maps VS Code workbench colors and TextMate rules to Monapad and Monaco", () => {
  const presentation = createVSCodeThemePresentation({
    type: "dark",
    uiTheme: "vs-dark",
    colors: {
      "editor.background": "#10141c",
      "editorGutter.background": "#0b0f16",
      "editor.foreground": "#bfbdb6",
      "titleBar.activeBackground": "#0d1017",
      "list.hoverBackground": "#47526640",
      "textLink.foreground": "#e6b450",
      "errorForeground": "#d95757",
      "unsafe.color": "red; background: url(https://invalid.example)",
    },
    tokenColors: [
      { scope: ["comment", "markup.quote.markdown"], settings: { foreground: "#5a6378", fontStyle: "italic" } },
      { scope: "markup.heading.markdown", settings: { foreground: "#e6b450", fontStyle: "bold" } },
    ],
  });

  assert.equal(presentation.monacoBase, "vs-dark");
  assert.equal(presentation.cssVariables["--color1"], "#10141c");
  assert.equal(presentation.cssVariables["--editor-gutter-background"], "#0b0f16");
  assert.equal(presentation.cssVariables["--color2"], "#0d1017");
  assert.equal(presentation.cssVariables["--color3"], "#47526640");
  assert.equal(presentation.cssVariables["--heading1"], "#e6b450");
  assert.equal(presentation.cssVariables["--blockQuoteStyle"], "italic");
  assert.equal(presentation.monacoColors["unsafe.color"], undefined);
  assert.ok(presentation.monacoRules.some((rule) => rule.token === "comment" && rule.foreground === "5a6378"));
});

test("uses complete light fallbacks and rejects unsafe color or font-style values", () => {
  const presentation = createVSCodeThemePresentation({
    uiTheme: "vs",
    colors: { "editor.background": "not-a-color" },
    tokenColors: [
      { scope: "comment", settings: { foreground: "#123456", fontStyle: "italic; color: red" } },
    ],
  });
  assert.equal(presentation.monacoBase, "vs");
  assert.equal(presentation.cssVariables["--color1"], "#ffffff");
  assert.equal(presentation.monacoRules[0].fontStyle, undefined);
  assert.equal(normalizeColor("transparent"), "transparent");
  assert.equal(normalizeColor("rgb(0, 0, 0)"), null);
});
