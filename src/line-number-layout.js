import { EditorOptions } from "monaco-editor/esm/vs/editor/common/config/editorOptions.js";

let installed = false;

export function installLineNumberLayout(monaco) {
  if (installed) return;
  installed = true;
  const widths = new Map();
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--line-number-font-family").trim();
  function digitWidth(font) {
    const style = { fontFamily, fontSize: font.fontSize + "px", fontWeight: font.fontWeight,
      letterSpacing: font.letterSpacing + "px", fontFeatureSettings: font.fontFeatureSettings,
      fontVariationSettings: font.fontVariationSettings, fontVariantNumeric: "tabular-nums" };
    const key = JSON.stringify([style, font.pixelRatio]);
    if (!widths.has(key)) {
      const probe = document.createElement("span");
      probe.textContent = "0123456789";
      Object.assign(probe.style, style, { position: "fixed", visibility: "hidden", width: "max-content" });
      document.body.append(probe);
      widths.set(key, probe.getBoundingClientRect().width / 10);
      probe.remove();
    }
    return widths.get(key);
  }

  // Monaco 0.55 only exposes a minimum *integer character count*, measured in
  // the text font. Adapt this one layout input so all editors reserve the exact
  // pixel width of their Consolas numbers. Do not mutate the shared FontInfo:
  // text measurement, wrapping and cursor positions must keep the text font.
  const layout = EditorOptions.layoutInfo;
  const compute = layout.compute;
  layout.compute = function (env, options, value) {
    if (options.get(EditorOptions.lineNumbers.id).renderType === 0) return compute.call(this, env, options, value);
    const digits = Math.max(env.lineNumbersDigitCount, options.get(EditorOptions.lineNumbersMinChars.id));
    const width = Math.ceil(digits * digitWidth(env.fontInfo));
    return compute.call(this, { ...env, fontInfo: { ...env.fontInfo, maxDigitWidth: width / digits } }, options, value);
  };
  document.fonts.addEventListener("loadingdone", () => {
    widths.clear();
    monaco.editor.remeasureFonts();
  });
}
