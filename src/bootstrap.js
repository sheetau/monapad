const savedLang = localStorage.getItem("lang") || "en";

const monacoNlsLoaders = {
  ja: () => require("monaco-editor/esm/nls.messages.ja.js"),
  zh: () => require("monaco-editor/esm/nls.messages.zh-cn.js"),
  de: () => require("monaco-editor/esm/nls.messages.de.js"),
};

if (monacoNlsLoaders[savedLang]) {
  monacoNlsLoaders[savedLang]();
}

globalThis.__MONAPAD_INITIAL_MONACO_NLS_LANG__ = savedLang;

require("./index.js");
