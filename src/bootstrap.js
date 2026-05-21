const savedLang = localStorage.getItem("lang") || "en";

const monacoNlsLoaders = {
  ja: () => require("monaco-editor/esm/nls.messages.ja.js"),
  zh: () => require("monaco-editor/esm/nls.messages.zh-cn.js"),
  de: () => require("monaco-editor/esm/nls.messages.de.js"),
};

const monacoNlsSupportedLangs = ["en", ...Object.keys(monacoNlsLoaders)];
const initialMonacoNlsLang = monacoNlsSupportedLangs.includes(savedLang) ? savedLang : "en";

if (monacoNlsLoaders[initialMonacoNlsLang]) {
  monacoNlsLoaders[initialMonacoNlsLang]();
}

globalThis.__MONAPAD_INITIAL_MONACO_NLS_LANG__ = initialMonacoNlsLang;
globalThis.__MONAPAD_MONACO_NLS_SUPPORTED_LANGS__ = monacoNlsSupportedLangs;

require("./index.js");
