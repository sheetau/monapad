import * as monaco from "monaco-editor";
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js";
import { INotificationService } from "monaco-editor/esm/vs/platform/notification/common/notification.js";
import { IQuickInputService } from "monaco-editor/esm/vs/platform/quickinput/common/quickInput.js";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css";
import { CustomSelect } from "./custom-select.js";
import { createDeviceShareController } from "./device-share.js";
import {
  registerMonacoFormattingActions as registerMonacoFormattingEditorActions,
  registerMonacoQuickInputActions as registerMonacoQuickInputEditorActions,
} from "./monaco-actions.js";
import { updateSettingsTooltipsUi, updateStaticUiText } from "./i18next.js";
import { createGlobalSearchController } from "./search.js";
import { createFileIconElement, createNotesPanelController, getDisplayNoteTitle, sortNotesForPanel } from "./notes.js";
import {
  createTabStripController,
  TAB_MAX_WIDTH,
  TAB_VERTICAL_DETACH_MAGNETISM,
} from "./tab-strip.js";
import {
  clampNumber,
  formatNoteUpdatedAt,
  getPathBasename,
  getUiLanguageTag,
  isDefaultThemeName,
  isPointInRect,
  normalizeFileReadResult,
  normalizeTextForModelComparison,
  truncateNoteTitle,
} from "./app-utils.js";
import i18next from "i18next";

const toolbar = document.getElementById("toolbar");
const tabsContainer = document.getElementById("tabs-container");
const tabs = document.getElementById("tabs");
const dropIndicator = document.getElementById("drop-indicator");
const windowControls = document.getElementById("window-controls");
const editor = document.getElementById("editor");
const addTabButton = document.getElementById("add-tab");
const menuButton = document.getElementById("menu-button");
const menu = document.getElementById("menu");
const changeThemeBtn = document.getElementById("changeTheme");
const themeMenu = document.getElementById("theme-menu");
const openRecentBtn = document.getElementById("openRecent");
const recentMenu = document.getElementById("recent-menu");
const newWindowBtn = document.getElementById("newWindowBtn");
const newTabBtn = document.getElementById("newTabBtn");
const newNoteBtn = document.getElementById("newNoteBtn");
const saveAsNoteBtn = document.getElementById("saveAsNoteBtn");
const settingsButton = document.getElementById("settingsBtn");
const toggleSidePanelBtn = document.getElementById("toggleSidePanelBtn");
const settingsMenu = document.getElementById("settings-menu");
const sidePanel = document.getElementById("side-panel");
const sidePanelClose = document.getElementById("side-panel-close");
const sidePanelMenuButton = document.getElementById("side-panel-menu-button");
const sidePanelResizeHandle = document.getElementById("side-panel-resize-handle");
const notesAddButton = document.getElementById("notes-add");
const foldersAddButton = document.getElementById("folders-add");
const notesListRefreshButton = document.getElementById("notes-list-refresh");
const notesListHeading = document.getElementById("notes-list-heading");
const globalSearchHeading = document.getElementById("global-search-heading");
const globalSearchInput = document.getElementById("global-search");
const globalSearchPlaceholder = document.getElementById("global-search-placeholder");
const globalSearchResults = document.getElementById("global-search-results");
const globalSearchResultsList = document.getElementById("global-search-results-list");
const globalSearchCaseButton = document.getElementById("global-search-case");
const globalSearchWordButton = document.getElementById("global-search-word");
const globalSearchRegexButton = document.getElementById("global-search-regex");
const globalSearchRefreshButton = document.getElementById("global-search-refresh");
const globalSearchClearButton = document.getElementById("global-search-clear");
const globalSearchCollapseButton = document.getElementById("global-search-collapse");
const notesList = document.getElementById("notes-list");
const noteContextMenu = document.getElementById("note-context-menu");
const customContextMenu = document.getElementById("custom-context-menu");
const tabContextMenu = document.getElementById("tab-context-menu");
const excludedIds = ["changeTheme", "openRecent"]; // buttons that dont close menu on click

// font family select, dropdown menu
const fontSelectRow = document.querySelector(".font-select-row");
const fontFamilySelect = document.getElementById("font-family-select");
let lastScrollTop = settingsMenu.scrollTop;
let scrollLocked = false; // focusin procss ongoing or not
let scrollAdjustQueue = []; // what scroll adjusting process to run after preventing focus() auto scroll

// font size
let wheelListener = null;
const fontSizeValue = document.getElementById("font-size-value");
const fontSizeDecrease = document.getElementById("font-size-decrease");
const fontSizeIncrease = document.getElementById("font-size-increase");
const STORAGE_KEY = "monacoFontSizePersistent";
const PINNED_TABS_STORAGE_KEY = "monapadPinnedTabs";
const PINNED_TABS_WINDOW_STORAGE_KEY = "monapadPinnedTabsByWindow";
const SIDE_PANEL_OPEN_STORAGE_KEY = "monapadSidePanelOpen";
const SIDE_PANEL_WIDTH_STORAGE_KEY = "monapadSidePanelWidth";
const SIDE_PANEL_MIN_WIDTH = 200;
const SIDE_PANEL_MAX_WIDTH = 300;
const SIDE_PANEL_DEFAULT_WIDTH = 240;
let persistentFontSize = Number(localStorage.getItem(STORAGE_KEY)) || 16;
let fontSize = persistentFontSize;

// tab size
const tabSizeValue = document.getElementById("tab-size-value");
const tabSizeDecrease = document.getElementById("tab-size-decrease");
const tabSizeIncrease = document.getElementById("tab-size-increase");
let tabSize = Math.min(10, Math.max(1, parseInt(localStorage.getItem("tabSize")) || 4));

// status bar
const statusLeft = document.getElementById("status-left");
const statusPathEl = statusLeft?.querySelector(".status-path");
const statusMessageEl = statusLeft?.querySelector(".status-message");
const statusExternalWarningEl = statusLeft?.querySelector(".status-external-warning");
const chordStatusEl = document.getElementById("chord-status");
const saveStatusEl = document.getElementById("save-status");
const backupStatusEl = document.getElementById("backup-status");
const lineColEl = document.getElementById("line-col");
const zoomLevelEl = document.getElementById("zoom-level");
const lineEndingEl = document.getElementById("line-ending");
const encodingEl = document.getElementById("encoding");

// modals
const confirmBox = document.getElementById("confirm-save-background");
const confirmSave = document.getElementById("confirm-save");
const yesBtn = document.getElementById("confirm-save-yes");
const noBtn = document.getElementById("confirm-save-no");
const cancelBtn = document.getElementById("confirm-save-cancel");
const confirmWindow = document.getElementById("confirm-save-window");
const saveAllBtn = document.getElementById("confirm-save-all");
const discardAllBtn = document.getElementById("confirm-discard-all");
const cancelAllBtn = document.getElementById("confirm-cancel-all");
const autosaveRestore = document.getElementById("autosave-restore");
const autosaveRestoreMessage = document.getElementById("autosave-restore-message");
const autosaveRestoreYes = document.getElementById("autosave-restore-yes");
const autosaveRestoreNo = document.getElementById("autosave-restore-no");
const about = document.getElementById("about");
const fileDropBox = document.getElementById("file-drop-background");
const fileDrop = document.getElementById("file-drop");
let deviceShareController = null;

// tab dragging
let lastPreviewX = null;
let lastPreviewY = null;
let draggingTab = null;
let draggingTabData = null;
let draggingTabWasPinned = false;
let tabDragOriginalOrder = null;
let tabDragOriginalActiveTab = null;
let dragStartX = 0;
let originalX = 0;
let startX = 0;
let currentX = 0;
let dragIndex = -1;
let wasOnlyTab = false;
let overlayWindowVisible = false;
let windowBoundsCache = null;
let dragStartClientPos = null;
let lastWindowCheck = 0;
let externalCancelDragging = null;
let externalPreviewTargetWindowId = null;
let cursorWindowMoveFrame = null;
let pendingCursorWindowPos = null;
// flag indicates enableTabDragging is middle of mousedown event, in case mouseup triggered middle of it
let isHandlingMouseDown = false;
let deferredOnMouseUp = false;
let deferredMouseUpEvent = null;
let tabPendingDeferredMouseUp = null;

let zoomLevel = 1;
let currentTab = { content: "", selection: null, fontSize: persistentFontSize };
let tabData = [];
let recentlyClosedFiles = [];
let currentTheme = localStorage.getItem("theme") || "dark";
let currentFilePath = `${i18next.t("file.untitled")}.txt`;
const defaultSettings = {
  lineHighlight: true,
  lineNumbers: false,
  minimap: true,
  syntaxHighlight: true,
  folding: true,
  statusBarVisible: true,
  kuromojiEnabled: false,
  defaultNewTabType: "untitled",
};
let storedSettings = {};
try {
  storedSettings = JSON.parse(localStorage.getItem("editorSettings") || "{}") || {};
} catch {
  storedSettings = {};
}
const settings = { ...defaultSettings, ...storedSettings };
let selectedFontFamily = localStorage.getItem("selectedFontFamily") || "Iosevka";
let monacoEditor = null;
const WRAP_MEASURE_OPTIONS = {
  wrappingStrategy: "advanced",
  disableMonospaceOptimizations: true,
};

const AUTOSAVE_DEBOUNCE_MS = 3000;
const AUTOSAVE_FORCE_MS = 30000;
const AUTOSAVE_MAX_ITEM_BYTES = 5 * 1024 * 1024;
const autosaveTimers = new Map();
let isRestoringAutosaveDrafts = false;
let transientStatusMessageId = null;
let transientStatusMessageTimer = null;
let saveStatusFadeTimer = null;

// tabs hover state
let tabAreaHovered = false;
let isHoveringLastTab = false;
let mouseX = 0;
let mouseY = 0;
let tabHoverMouseWatcherTimer = null;
let tabHoverMouseWatcherBusy = false;

// editor context menu
let isWordWrapOn = true;
let isMarkdownOn = false;

// modal display state
let isModalDisplayed = false;
let dragCounter = 0;

// store right clicked tab
let rightClickedTab = null;
let notesIndexCache = [];
let globalSearchController = null;
let notesController = null;

const tabStrip = createTabStripController({
  tabs,
  tabsContainer,
  addTabButton,
  getTabData: () => tabData,
  getDraggingTab: () => draggingTab,
  getDraggingTabData: () => draggingTabData,
  setCurrentX: (value) => {
    currentX = value;
  },
  getPinnedTabCount,
});
const {
  addClosingTabSlot,
  calculateTabLayout,
  cancelTabLayoutAnimation,
  clampDropPlacementAfterPinnedTabs,
  clampDropPlacementForTab,
  clearTabClosingModeAvailableWidth,
  enterTabClosingMode,
  exitTabClosingMode,
  finishTabLayoutAnimations,
  getCurrentTabBounds,
  getTabDragAreaWidth,
  getTabDropPlacementByClientX,
  getTabStripAvailableDragWidth,
  getTabsIdealTrailingX,
  isOutsideTabDragContext,
  isPointInLocalTabDragArea,
  isTabLayoutAnimating,
  layoutTabs,
  maybeExitTabClosingModeAfterClose,
  scheduleClosingTabCleanup,
  setTabBounds,
  setTabClosingModeAvailableWidth,
  setTabDragExtendedWidth,
  updateTabsCompactClass,
  updateTabsWidthForDraggedTab,
} = tabStrip;
tabStrip.observeTabsResize();

// watch only active tab, remove old watcher when tab switched (switchTab)
let currentWatchedFilePath = null;
// watch css file used as current theme
let currentWatchedCssFile = null;

// get window id
let myWindowId = null;
let resolveWindowIdReady = null;
const windowIdReady = new Promise((resolve) => {
  resolveWindowIdReady = resolve;
});
window.electronAPI.onAssignWindowId((id) => {
  myWindowId = id;
  resolveWindowIdReady?.(id);
});

window.electronAPI.onShowExternalDropIndicator(({ dropScreenX, dropScreenY, tabInfo }) => {
  const existingTab = getExistingTabForPayload(tabInfo);
  showExternalDropIndicator(dropScreenX, dropScreenY, existingTab?.element || null, existingTab || null);
});
window.electronAPI.onHideExternalDropIndicator(() => {
  hideDropIndicator();
});

// app version
window.electronAPI.getAppVersion().then((versions) => {
  document.querySelector("#version-text").textContent = `v${versions.app}`;
  document.querySelector("#version-detail-text").innerHTML =
    `Electron: ${versions.electron}<br>Chromium: ${versions.chrome}<br>Node.js: ${versions.node}<br>V8: ${versions.v8}`;
});

function scheduleCursorWindowMove(screenX, screenY) {
  pendingCursorWindowPos = { x: screenX, y: screenY };
  if (cursorWindowMoveFrame !== null) return;

  cursorWindowMoveFrame = requestAnimationFrame(() => {
    cursorWindowMoveFrame = null;
    const pos = pendingCursorWindowPos;
    pendingCursorWindowPos = null;
    if (pos) window.electronAPI.moveCursorWindow(pos.x, pos.y);
  });
}

function resetCursorWindowMove() {
  if (cursorWindowMoveFrame !== null) {
    cancelAnimationFrame(cursorWindowMoveFrame);
    cursorWindowMoveFrame = null;
  }
  pendingCursorWindowPos = null;
}

// file open on launch
window.electronAPI.onOpenFile(async (filePath) => {
  try {
    await loadFileByPath(filePath);
    console.log("File opened successfully via association:", filePath);
    window.electronLog.info("File opened successfully via association:", filePath);
  } catch (error) {
    console.error("Failed to open file via association:", error);
    window.electronLog.error("Failed to open file via association:", error);
  }
});

function getTabInsertIndexByScreenX(screenX, excludeTab = null) {
  if (typeof screenX !== "number") return null;
  return getTabDropPlacementByClientX(screenX - window.screenX, excludeTab).index;
}

function getExistingTabForPayload(payload) {
  if (!payload) return null;
  if (payload.isNote && payload.noteId) {
    return tabData.find((tab) => tab.isNote && tab.noteId === payload.noteId) || null;
  }
  if (payload.path) {
    return tabData.find((tab) => tab.path === payload.path) || null;
  }
  return null;
}

function getSearchRangeFromPayload(payload) {
  const range = payload?.searchRange;
  if (!range) return null;
  const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
  if (![startLineNumber, startColumn, endLineNumber, endColumn].every(Number.isFinite)) return null;
  return new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn);
}

function revealSearchRange(range) {
  if (!range || !monacoEditor) return;
  monacoEditor.setSelection(range);
  monacoEditor.revealRangeInCenterIfOutsideViewport(range);
}

function revealSearchRangeFromPayload(payload) {
  revealSearchRange(getSearchRangeFromPayload(payload));
}

// receive data on open in new window
window.electronAPI.onLoadTabData(async (receivedTabData) => {
  hideDropIndicator();
  const payload = receivedTabData.tabInfo || receivedTabData;
  const existingTab = getExistingTabForPayload(payload);
  const placement =
    typeof receivedTabData.dropScreenX === "number"
      ? getTabDropPlacementByClientX(receivedTabData.dropScreenX - window.screenX, existingTab?.element || null)
      : { index: null, referenceTab: null };
  if (existingTab?.isPinned) {
    switchTab(existingTab);
    revealSearchRangeFromPayload(payload);
    return;
  }
  const adjustedPlacement = clampDropPlacementAfterPinnedTabs(placement, existingTab?.element || null);
  const insertIndex = adjustedPlacement.index;

  if (payload.isNote) {
    await createNoteTabFromPayload(payload, insertIndex, adjustedPlacement);
    revealSearchRangeFromPayload(payload);
    return;
  }

  if (existingTab) {
    moveTabToDropPlacement(existingTab, adjustedPlacement);
    switchTab(existingTab);
    revealSearchRangeFromPayload(payload);
    return;
  }

  // remove existing initial tab
  if (getReusableEmptyTab({ includeNotes: true }) === tabData[0]) {
    const defaultTab = tabData[0];
    await prepareReusableEmptyTabForReplacement(defaultTab);
    tabs.removeChild(defaultTab.element);
    defaultTab.model?.dispose();
    tabData = [];
    layoutTabs({ animate: false });
  }

  // create new tab
  const newTabData = createTab(payload.name, payload.content, payload.path, insertIndex, payload);

  // restore tab data
  newTabData.isFileSaved = payload.isFileSaved;
  newTabData.originalContent = payload.originalContent;
  newTabData.fontSize = payload.fontSize;
  newTabData.wordWrap = payload.wordWrap;
  newTabData.isMarkdown = payload.isMarkdown;
  newTabData.draftId = payload.draftId || newTabData.draftId;
  if (payload.isNote) {
    newTabData.isNote = true;
    newTabData.noteId = payload.noteId;
    newTabData.notePath = payload.notePath;
    newTabData.noteFolderPath = payload.noteFolderPath || "";
    newTabData.noteTitle = payload.noteTitle || payload.name;
    newTabData.noteCreatedAt = payload.noteCreatedAt;
    newTabData.noteUpdatedAt = payload.noteUpdatedAt;
    newTabData.noteDirty = false;
    newTabData.draftId = null;
    newTabData.path = null;
    newTabData.isFileSaved = true;
    newTabData.originalContent = payload.content;
    newTabData.element.classList.add("note");
    newTabData.element.querySelector(".close")?.classList.remove("show-unsaved");
    updateNoteTabTitle(newTabData, payload.content);
  }

  // restore save state
  if (!payload.isNote && !payload.isFileSaved) {
    const close = newTabData.element.querySelector(".close");
    if (close) close.classList.add("show-unsaved");
    await windowIdReady;
    await writeTabAutosave(newTabData, newTabData.model.getValue());
    scheduleTabAutosave(newTabData, newTabData.model.getValue());
  }

  if (payload.hasReloadButton) {
    reloadButton(newTabData, payload.path, "add");
  }

  switchTab(newTabData);
  revealSearchRangeFromPayload(payload);
});

// language
const langSwitcher = document.getElementById("langSwitcher");
const savedLang = localStorage.getItem("lang") || "en";
const initialMonacoNlsLang = globalThis.__MONAPAD_INITIAL_MONACO_NLS_LANG__ || savedLang;
const monacoNlsSupportedLangs = new Set(globalThis.__MONAPAD_MONACO_NLS_SUPPORTED_LANGS__ || ["en"]);
const monacoNlsRestartWarning = document.getElementById("monacoNlsRestartWarning");
langSwitcher.value = savedLang;

function applyUiLanguage(lang) {
  document.documentElement.lang = getUiLanguageTag(lang);
}

function updateMonacoNlsRestartWarning(lang) {
  if (!monacoNlsRestartWarning) return;
  const monacoNlsLang = monacoNlsSupportedLangs.has(lang) ? lang : "en";
  monacoNlsRestartWarning.hidden = monacoNlsLang === initialMonacoNlsLang;
}

applyUiLanguage(savedLang);

const langDropdown = new CustomSelect(langSwitcher, {
  searchEnabled: false,
  position: "bottom",
  onBeforeOpen() {
    closeContextMenus({ focus: false });
  },
});

langDropdown.setChoiceByValue(savedLang);

i18next
  .init({
    lng: savedLang,
    fallbackLng: "en",
    // git pull required when additional language PR merged in github.
    // mayb switch to i18next-fs-backend in the future
    resources: {
      en: { translation: require("./locales/en-US.json") },
      ja: { translation: require("./locales/ja-JP.json") },
      zh: { translation: require("./locales/zh-CN.json") },
      de: { translation: require("./locales/de-DE.json") },
      pt: { translation: require("./locales/pt-BR.json") },
    },
  })
  .then(() => {
    applyUiLanguage(i18next.language);
    updateMenuLabels();
    registerMonacoFormattingActions();
    registerMonacoQuickInputActions();
  });

function getI18nUiContext() {
  return {
    t: i18next.t.bind(i18next),
    refs: {
      autosaveRestoreMessage,
      autosaveRestoreNo,
      autosaveRestoreYes,
      deviceShareController,
      foldersAddButton,
      globalSearchHeading,
      globalSearchInput,
      monacoNlsRestartWarning,
      noteContextMenu,
      notesAddButton,
      notesListHeading,
      notesListRefreshButton,
      sidePanelClose,
      tabContextMenu,
    },
    state: {
      rightClickedTab,
      selectedFontFamily,
    },
    callbacks: {
      updateGlobalSearchLabels,
      updateGlobalSearchPlaceholder,
      updateGlobalSearchResultHeaderLabels,
      updateMainMenuState,
      updateNewTabShortcutLabels,
      updateTabContextMenuState,
    },
  };
}

function updateMenuLabels() {
  updateStaticUiText(getI18nUiContext());
}

function updateSettingsTooltips() {
  updateSettingsTooltipsUi({
    t: i18next.t.bind(i18next),
    selectedFontFamily,
  });
}

function updateMainMenuState() {
  saveAsNoteBtn?.classList.toggle("disabled", Boolean(currentTab?.isNote));
}

langSwitcher.addEventListener("change", () => {
  const newLang = langDropdown.getValue(true);

  i18next.changeLanguage(newLang).then(async () => {
    applyUiLanguage(newLang);
    updateMenuLabels();
    updateMonacoNlsRestartWarning(newLang);
    registerMonacoFormattingActions();
    registerMonacoQuickInputActions();
    await renderNotesList();
    await populateRecentMenu();
    updateStatusBar();
  });

  localStorage.setItem("lang", newLang);
});

// get css variable
// getCSSVar("--var-name"), getCSSVar("var(--color)"), getCSSVar("#ffffff") → "#ffffff"
function getCSSVar(nameOrValue, depth = 0) {
  // max depth to prevent infinite loop
  if (depth > 5) return nameOrValue;

  if (nameOrValue.startsWith("var(")) {
    // getCSSVar("var(--color)") → "#ffffff"
    const varMatch = nameOrValue.match(/^var\((--[^,\s)]+)(?:\s*,\s*[^)]+)?\)$/);
    if (varMatch) {
      const innerVarName = varMatch[1];
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(innerVarName).trim();
      if (resolved && resolved !== nameOrValue) {
        return getCSSVar(resolved, depth + 1);
      }
    }
    return nameOrValue;
  } else if (nameOrValue.startsWith("--")) {
    // getCSSVar("--var-name") → "#ffffff"
    const value = getComputedStyle(document.documentElement).getPropertyValue(nameOrValue).trim();
    if (value.startsWith("var(")) {
      return getCSSVar(value, depth + 1);
    }
    return value;
  } else {
    // getCSSVar("#ffffff") → "#ffffff"
    return nameOrValue;
  }
}

// get monaco editor css variable
// getAllCSSVars("--vscode-") → editor.background:
function getAllCSSVars(prefix = "--", fromLast = true) {
  const result = Object.create(null);

  // search from last style tag if fromLast = true;
  const styleSheets = Array.from(document.styleSheets);
  if (fromLast) styleSheets.reverse();

  for (const sheet of styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    // process only :root
    const rootRule = Array.from(rules).find((rule) => rule.selectorText === ":root");
    if (!rootRule) continue;

    // search vars in :root
    for (const name of rootRule.style) {
      // verify beginning of var (--vscode → --vscode-editor-background)
      if (!name.startsWith(prefix)) continue;
      // remove prefix
      const varName = name.slice(prefix.length);
      let token;
      if (prefix === "--md-") {
        // --md-keyword → keyword.md
        token = varName.replace(/[-_]/g, ".") + ".md";
      } else {
        // --vscode-editor-background → editor.background
        token = varName.replace(/[-_]/g, ".");
      }
      // get original value if value was set as var
      const value = getCSSVar(rootRule.style.getPropertyValue(name).trim());
      result[token] = value;
    }
    // break with first found :root
    break;
  }

  if (Object.keys(result).length === 0) {
    console.warn("No :root rule with the specified prefix found.");
  }

  return result;
}

const MONAPAD_CODE_BLOCK_LANGUAGE_RULES = [
  [
    /^\s*```\s*(javascript|js|jsx)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "javascript" },
  ],
  [
    /^\s*```\s*(typescript|ts|tsx)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "typescript" },
  ],
  [/^\s*```\s*(html)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "html" }],
  [/^\s*```\s*(css)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "css" }],
  [/^\s*```\s*(scss|sass)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "scss" }],
  [/^\s*```\s*(less)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "less" }],
  [
    /^\s*```\s*(json|jsonc)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "json" },
  ],
  [
    /^\s*```\s*(markdown|md)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "markdown" },
  ],
  [/^\s*```\s*(xml|svg)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "xml" }],
  [/^\s*```\s*(yaml|yml)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "yaml" }],
  [
    /^\s*```\s*(python|py)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "python" },
  ],
  [
    /^\s*```\s*(shell|sh|bash|zsh)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "shell" },
  ],
  [
    /^\s*```\s*(powershell|ps1)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "powershell" },
  ],
  [/^\s*```\s*(bat|cmd)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "bat" }],
  [/^\s*```\s*(sql)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "sql" }],
  [/^\s*```\s*(c)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "cpp" }],
  [/^\s*```\s*(cpp|c\+\+)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "cpp" }],
  [
    /^\s*```\s*(csharp|cs|c#)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "csharp" },
  ],
  [/^\s*```\s*(java)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "java" }],
  [/^\s*```\s*(php)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "php" }],
  [/^\s*```\s*(ruby|rb)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "ruby" }],
  [/^\s*```\s*(go|golang)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "go" }],
  [/^\s*```\s*(rust|rs)(?=\s|$).*$/, { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "rust" }],
  [
    /^\s*```\s*(dockerfile|docker)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "dockerfile" },
  ],
  [
    /^\s*```\s*(ini|properties)(?=\s|$).*$/,
    { token: "code-block-fence", next: "@codeblockEmbedded", nextEmbedded: "ini" },
  ],
];

// define monapad language
monaco.languages.register({ id: "monapad" });
monaco.languages.setMonarchTokensProvider("monapad", {
  tokenizer: {
    root: [
      [/^\s*\d+\.\s/, "number-list"], // number list e.g., 1. item
      [/^\s*[-*+] /, "bullet-point"], // bullet points
      [/^\s*-#\s[^#].*/, "sub-text"], // -# subtext
      [/^\s*#\s[^#].*/, "heading-1"], // # heading
      [/^\s*##\s[^#].*/, "heading-2"], // ## heading
      [/^\s*###\s[^#].*/, "heading-3"], // ### heading
      [/^\s*>\s.*/, "block-quote"], // > blockquote
      ...MONAPAD_CODE_BLOCK_LANGUAGE_RULES,
      [/^\s*```\s*((?:\w|[\/\-#])+).*$/, { token: "code-block-fence", next: "@codeblock" }], // code block with unsupported language
      [/^\s*```\s*$/, { token: "code-block-fence", next: "@codeblock" }], // code block
      [/`([^\\`]|\\.)+`/, "inline-code"], // inline code block
    ],

    codeblock: [
      [/^\s*```\s*$/, { token: "code-block-fence", next: "@pop" }],
      [/.*$/, "code-block-content"],
    ],

    codeblockEmbedded: [
      [/```\s*$/, { token: "code-block-fence", next: "@pop", nextEmbedded: "@pop" }],
      [/[^`]+/, "code-block-content"],
      [/`/, "code-block-content"],
    ],
  },
});

// symbol
monaco.languages.registerDocumentSymbolProvider("monapad", {
  provideDocumentSymbols(model, token) {
    const lines = model.getLinesContent();
    const symbols = [];

    // code block range
    const codeBlocks = [];
    let codeBlockStart = null;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        if (codeBlockStart === null) {
          codeBlockStart = i;
        } else {
          codeBlocks.push({ start: codeBlockStart, end: i });
          codeBlockStart = null;
        }
      }
    });

    function isInsideCodeBlock(lineNumber) {
      return codeBlocks.some((block) => lineNumber >= block.start && lineNumber <= block.end);
    }

    lines.forEach((line, lineNumber) => {
      if (isInsideCodeBlock(lineNumber)) return;

      const trimmed = line.trim();

      let match, name, headingPrefix, kind;

      if ((match = trimmed.match(/^###\s+(.*)/))) {
        headingPrefix = "### ";
        kind = monaco.languages.SymbolKind.Method; // Level 3
      } else if ((match = trimmed.match(/^##\s+(.*)/))) {
        headingPrefix = "## ";
        kind = monaco.languages.SymbolKind.Function; // Level 2
      } else if ((match = trimmed.match(/^#\s+(.*)/))) {
        headingPrefix = "# ";
        kind = monaco.languages.SymbolKind.Class; // Level 1
      }

      if (headingPrefix) {
        name = headingPrefix + match[1];
        const lineNum = lineNumber + 1;
        const fullRange = new monaco.Range(lineNum, 1, lineNum, line.length + 1);

        const startCol = line.indexOf(match[1]) + 1;
        const selectRange = new monaco.Range(lineNum, startCol, lineNum, startCol + match[1].length);

        symbols.push({
          name,
          kind,
          range: fullRange,
          selectionRange: selectRange,
        });
      }
    });

    return symbols;
  },
});

// folding
monaco.languages.registerFoldingRangeProvider("monapad", {
  provideFoldingRanges(model, context, token) {
    const ranges = [];
    const lines = model.getLineCount();

    // code block
    const codeBlocks = [];
    let codeBlockStart = null;

    for (let lineNumber = 1; lineNumber <= lines; lineNumber++) {
      const line = model.getLineContent(lineNumber).trim();

      if (line.startsWith("```")) {
        if (codeBlockStart === null) {
          codeBlockStart = lineNumber;
        } else {
          const codeBlockEnd = lineNumber;
          codeBlocks.push({ start: codeBlockStart, end: codeBlockEnd });
          ranges.push({
            start: codeBlockStart,
            end: codeBlockEnd,
            kind: monaco.languages.FoldingRangeKind.Region,
          });
          codeBlockStart = null;
        }
      }
    }

    // check if heading is inside code block
    function isInsideCodeBlock(lineNumber) {
      return codeBlocks.some((block) => lineNumber >= block.start && lineNumber <= block.end);
    }

    // heading
    const headingRegexes = [
      { level: 1, regex: /^\s*#\s[^#]/ },
      { level: 2, regex: /^\s*##\s[^#]/ },
      { level: 3, regex: /^\s*###\s[^#]/ },
    ];

    const headings = [];

    for (let lineNumber = 1; lineNumber <= lines; lineNumber++) {
      if (isInsideCodeBlock(lineNumber)) continue;

      const line = model.getLineContent(lineNumber);
      for (const { level, regex } of headingRegexes) {
        if (regex.test(line)) {
          headings.push({ lineNumber, level });
          break;
        }
      }
    }

    for (let i = 0; i < headings.length; i++) {
      const { lineNumber: startLine, level } = headings[i];
      let endLine = lines;

      for (let j = i + 1; j < headings.length; j++) {
        if (headings[j].level <= level) {
          endLine = headings[j].lineNumber - 1;
          break;
        }
      }

      // do not include empty line
      while (endLine > startLine && model.getLineContent(endLine).trim() === "") {
        endLine--;
      }

      // only when range is more than one line
      if (endLine > startLine) {
        ranges.push({
          start: startLine,
          end: endLine,
          kind: monaco.languages.FoldingRangeKind.Region,
        });
      }
    }

    return ranges;
  },
});

// apply colors to monaco editor
function createCustomTheme() {
  const isDefaultTheme = isDefaultThemeName(currentTheme);

  // vscode css vars
  const colors = Object.create(null);
  // isDefaultTheme: search first style tag, !isDefaultTheme: search last style tag
  const vscodeVars = isDefaultTheme ? getAllCSSVars("--vscode-", false) : getAllCSSVars("--vscode-", true);
  // --vscode-editor-background: #hex / var(--color) → editor.background = #hex
  Object.entries(vscodeVars).forEach(([token, value]) => {
    colors[token] = value;
  });

  // monapad, markdown css vars
  const rules = [];

  if (settings.syntaxHighlight) {
    function makeRule(token, colorVarBase) {
      return {
        token,
        foreground: getCSSVar(`--${colorVarBase}`),
        fontStyle: `${getCSSVar(`--${colorVarBase}Style`)}`.trim() || undefined,
      };
    }

    rules.push(
      makeRule("number-list", "numberList"),
      makeRule("bullet-point", "bulletPoint"),
      makeRule("sub-text", "subText"),
      makeRule("heading-1", "heading1"),
      makeRule("heading-2", "heading2"),
      makeRule("heading-3", "heading3"),
      makeRule("block-quote", "blockQuote"),
      makeRule("inline-code", "inlineCode"),
      makeRule("code-block-fence", "codeBlockFence"),
      makeRule("code-block-content", "codeBlock"),
    );
  }

  if (!isDefaultTheme) {
    // search last style tag since default theme doesn't specify markdwon color
    const markdownVars = getAllCSSVars("--md-", true);
    // --strong-md: #hex / var(--color) → { token: "strong.md", foreground: #hex },
    const markdownRules = Object.entries(markdownVars).map(([token, value]) => ({ token, foreground: value }));
    rules.push(...markdownRules);
  }

  return {
    base: "vs-dark",
    inherit: true,
    rules,
    colors,
    insertSpaces: false,
  };
}
monaco.editor.defineTheme("custom-theme", createCustomTheme());

monacoEditor = monaco.editor.create(editor, {
  language: "monapad",
  wordWrap: "on",
  ...WRAP_MEASURE_OPTIONS,
  minimap: { enabled: settings.minimap, renderCharacters: true },
  renderLineHighlight: settings.lineHighlight ? "line" : "none",
  lineNumbers: settings.lineNumbers ? "on" : "off",
  lineNumbersMinChars: 1,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: editor.clientHeight / 2 },
  occurrencesHighlight: false,
  stickyScroll: { enabled: false },
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: false,
  matchBrackets: "never",
  fontSize: persistentFontSize,
  fontFamily: `"${selectedFontFamily}", "Migu 1M", monospace`,
  fontLigatures: true,
  unicodeHighlight: {
    nonBasicASCII: false,
    ambiguousCharacters: false,
    invisibleCharacters: false,
  },
  autoClosingBrackets: "never",
  contextmenu: false,
  renderIndentGuides: false,
  insertSpaces: false,
  tabSize: tabSize,
  find: {
    addExtraSpaceOnTop: false,
  },
  scrollbar: { horizontal: "hidden" },
  folding: settings.folding,
  foldingStrategy: "auto",
  copyWithSyntaxHighlighting: false,
  cursorSmoothCaretAnimation: false,
});

function installMonacoStatusBarBridge() {
  if (!chordStatusEl) return;

  try {
    const notificationService = StandaloneServices.get(INotificationService);
    if (!notificationService || notificationService.__monapadStatusBarBridgeInstalled) return;

    const originalStatus =
      typeof notificationService.status === "function" ? notificationService.status.bind(notificationService) : null;
    let statusSeq = 0;
    let hideTimer = null;

    function clearStatus(id) {
      if (id !== statusSeq) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      chordStatusEl.textContent = "";
      chordStatusEl.title = "";
    }

    notificationService.status = (message, options = {}) => {
      const id = ++statusSeq;
      const text = localizeMonacoStatusMessage(message);
      const originalHandle = originalStatus ? originalStatus(message, options) : null;

      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      chordStatusEl.textContent = text;
      chordStatusEl.title = text;

      if (typeof options.hideAfter === "number" && options.hideAfter > 0) {
        hideTimer = setTimeout(() => clearStatus(id), options.hideAfter);
      }

      return {
        close() {
          originalHandle?.close?.();
          clearStatus(id);
        },
      };
    };

    notificationService.__monapadStatusBarBridgeInstalled = true;
  } catch (err) {
    console.warn("Failed to install Monaco status bar bridge:", err);
  }
}

installMonacoStatusBarBridge();

function localizeMonacoStatusMessage(message) {
  const text = message == null ? "" : String(message);

  let match = text.match(/^\((.*)\) was pressed\. Waiting for second key of chord\.\.\.$/);
  if (match) {
    return i18next.t("statusBar.chordFirst", { first: match[1] });
  }

  match = text.match(/^\((.*)\) was pressed\. Waiting for next key of chord\.\.\.$/);
  if (match) {
    return i18next.t("statusBar.chordNext", { keys: match[1] });
  }

  match = text.match(/^The key combination \((.*)\) is not a command\.$/);
  if (match) {
    return i18next.t("statusBar.chordMissing", { keys: match[1] });
  }

  return text;
}

// Japanese word handling
let setKuromojiEnabled = () => {};

(function setupJapaneseWordHandling() {
  // fallback based on character category
  function getCharCategory(ch) {
    if (!ch) return null;
    const cp = ch.codePointAt(0);
    if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return "ascii_alnum";
    if (cp === 0x20 || cp === 0x09) return "space";
    if (cp >= 0x21 && cp <= 0x7e) return "ascii_symbol_" + cp;
    if (cp >= 0x3041 && cp <= 0x309f) return "hiragana";
    if ((cp >= 0x30a0 && cp <= 0x30ff) || cp === 0xff70 || (cp >= 0xff65 && cp <= 0xff9f)) return "katakana";
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0x20000 && cp <= 0x2a6df)
    )
      return "kanji";
    if (
      (cp >= 0x3000 && cp <= 0x303f) ||
      (cp >= 0xff01 && cp <= 0xff0f) ||
      (cp >= 0xff1a && cp <= 0xff20) ||
      (cp >= 0xff3b && cp <= 0xff40) ||
      (cp >= 0xff5b && cp <= 0xff65)
    )
      return "jp_punct_" + cp;
    if (cp >= 0xff10 && cp <= 0xff19) return "fw_digit";
    if (cp >= 0xff21 && cp <= 0xff3a) return "fw_upper";
    if (cp >= 0xff41 && cp <= 0xff5a) return "fw_lower";
    return "other_" + cp;
  }

  function isSingleCharCategory(cat) {
    return cat && (cat.startsWith("ascii_symbol_") || cat.startsWith("jp_punct_") || cat === "space");
  }

  function getWordRangeFallback(lineText, col0) {
    const len = lineText.length;
    if (len === 0) return { start: 0, end: 0 };
    const c = Math.min(col0, len - 1);
    const pivotCat = getCharCategory(lineText[c]);
    if (isSingleCharCategory(pivotCat)) return { start: c, end: c + 1 };
    let start = c;
    while (start > 0 && getCharCategory(lineText[start - 1]) === pivotCat) start--;
    let end = c + 1;
    while (end < len && getCharCategory(lineText[end]) === pivotCat) end++;
    return { start, end };
  }

  // kuromoji tokenization with caching, token boundaries only
  let tokenCache = { text: null, boundaries: null };

  let kuromojiEnabled = settings.kuromojiEnabled;

  setKuromojiEnabled = (val) => {
    kuromojiEnabled = val;
    tokenCache = { text: null, boundaries: null };
  };

  async function getBoundaries(lineText) {
    if (!kuromojiEnabled) return null;
    if (tokenCache.text === lineText) return tokenCache.boundaries;
    const tokens = await window.electronAPI.tokenize(lineText);
    if (!tokens) return null;
    const boundaries = [];
    let pos = 0;
    for (const surface of tokens) {
      boundaries.push(pos);
      pos += surface.length;
    }
    boundaries.push(pos);
    tokenCache = { text: lineText, boundaries };
    return boundaries;
  }

  function findTokenRange(boundaries, col0) {
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (col0 >= boundaries[i] && col0 < boundaries[i + 1]) {
        return { start: boundaries[i], end: boundaries[i + 1] };
      }
    }
    const last = boundaries[boundaries.length - 1];
    return { start: last, end: last };
  }

  function nextBoundary(boundaries, col0) {
    for (const b of boundaries) {
      if (b > col0) return b;
    }
    return boundaries[boundaries.length - 1];
  }

  function prevBoundary(boundaries, col0) {
    let prev = 0;
    for (const b of boundaries) {
      if (b >= col0) return prev;
      prev = b;
    }
    return prev;
  }

  // public API
  async function getWordRange(lineText, col0) {
    const boundaries = await getBoundaries(lineText);
    if (!boundaries) return getWordRangeFallback(lineText, col0);
    return findTokenRange(boundaries, col0);
  }

  async function moveRight(lineText, col0) {
    const len = lineText.length;
    if (col0 >= len) return len;
    const boundaries = await getBoundaries(lineText);
    if (!boundaries) {
      const cat = getCharCategory(lineText[col0]);
      if (isSingleCharCategory(cat)) return col0 + 1;
      let i = col0 + 1;
      while (i < len && getCharCategory(lineText[i]) === cat) i++;
      return i;
    }
    return nextBoundary(boundaries, col0);
  }

  async function moveLeft(lineText, col0) {
    if (col0 <= 0) return 0;
    const boundaries = await getBoundaries(lineText);
    if (!boundaries) {
      const cat = getCharCategory(lineText[col0 - 1]);
      if (isSingleCharCategory(cat)) return col0 - 1;
      let i = col0 - 1;
      while (i > 0 && getCharCategory(lineText[i - 1]) === cat) i--;
      return i;
    }
    return prevBoundary(boundaries, col0);
  }

  // ctrl + arror, ctrl + shift + arrow, ctrl + delete/backspace
  async function execJapaneseWordMove(mode, select, del) {
    const model = monacoEditor.getModel();
    if (!model) return;
    const selections = monacoEditor.getSelections();

    if (del) {
      const edits = (
        await Promise.all(
          selections.map(async (sel) => {
            const curLine = sel.positionLineNumber;
            const curCol1 = sel.positionColumn;
            const lineText = model.getLineContent(curLine);
            const lineLen = lineText.length;

            if (del === "deleteRight") {
              if (!sel.isEmpty()) return { range: sel, text: "" };
              if (curCol1 - 1 >= lineLen) {
                const lineCount = model.getLineCount();
                if (curLine >= lineCount) return null;
                return { range: new monaco.Range(curLine, curCol1, curLine + 1, 1), text: "" };
              }
              const end0 = await moveRight(lineText, curCol1 - 1);
              return { range: new monaco.Range(curLine, curCol1, curLine, end0 + 1), text: "" };
            } else {
              if (!sel.isEmpty()) return { range: sel, text: "" };
              if (curCol1 === 1) {
                if (curLine <= 1) return null;
                const prevLineLen = model.getLineContent(curLine - 1).length;
                return { range: new monaco.Range(curLine - 1, prevLineLen + 1, curLine, 1), text: "" };
              }
              const start0 = await moveLeft(lineText, curCol1 - 1);
              return { range: new monaco.Range(curLine, start0 + 1, curLine, curCol1), text: "" };
            }
          }),
        )
      ).filter(Boolean);

      if (edits.length) {
        monacoEditor.pushUndoStop();
        monacoEditor.executeEdits("japanese-word-delete", edits);
        monacoEditor.pushUndoStop();
      }
      return;
    }

    const newSelections = await Promise.all(
      selections.map(async (sel) => {
        let curLine = sel.positionLineNumber;
        let curCol1 = sel.positionColumn;
        const lineText = model.getLineContent(curLine);
        const lineLen = lineText.length;
        let newCol1;

        if (mode === "right") {
          if (curCol1 - 1 >= lineLen) {
            const lineCount = model.getLineCount();
            if (curLine < lineCount) {
              curLine++;
              newCol1 = 1;
            } else newCol1 = curCol1;
          } else {
            newCol1 = (await moveRight(lineText, curCol1 - 1)) + 1;
          }
        } else {
          if (curCol1 === 1) {
            if (curLine > 1) {
              curLine--;
              newCol1 = model.getLineContent(curLine).length + 1;
            } else newCol1 = 1;
          } else {
            newCol1 = (await moveLeft(lineText, curCol1 - 1)) + 1;
          }
        }

        if (select) {
          return new monaco.Selection(sel.selectionStartLineNumber, sel.selectionStartColumn, curLine, newCol1);
        }
        return new monaco.Selection(curLine, newCol1, curLine, newCol1);
      }),
    );

    monacoEditor.setSelections(newSelections);
  }

  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.RightArrow, () =>
    execJapaneseWordMove("right", false, null),
  );
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.LeftArrow, () =>
    execJapaneseWordMove("left", false, null),
  );
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.RightArrow, () =>
    execJapaneseWordMove("right", true, null),
  );
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.LeftArrow, () =>
    execJapaneseWordMove("left", true, null),
  );
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Delete, () =>
    execJapaneseWordMove("right", false, "deleteRight"),
  );
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backspace, () =>
    execJapaneseWordMove("left", false, "deleteLeft"),
  );

  // double click

  monacoEditor.onMouseDown((e) => {
    if (e.event.detail !== 2) return;

    const CONTENT_TEXT = monaco.editor.MouseTargetType.CONTENT_TEXT;
    const CONTENT_EMPTY = monaco.editor.MouseTargetType.CONTENT_EMPTY;
    if (e.target.type !== CONTENT_TEXT && e.target.type !== CONTENT_EMPTY) return;

    const pos = e.target.position;
    if (!pos) return;

    e.event.preventDefault();

    const model = monacoEditor.getModel();
    if (!model) return;
    const lineText = model.getLineContent(pos.lineNumber);
    const col0 = pos.column - 1;

    const fallback = getWordRangeFallback(lineText, col0);
    monacoEditor.setSelection(new monaco.Range(pos.lineNumber, fallback.start + 1, pos.lineNumber, fallback.end + 1));

    getWordRange(lineText, col0).then(({ start, end }) => {
      const cur = monacoEditor.getSelection();
      if (cur && cur.startLineNumber === pos.lineNumber) {
        monacoEditor.setSelection(new monaco.Range(pos.lineNumber, start + 1, pos.lineNumber, end + 1));
      }
    });
  });
})();

function registerMonacoFormattingActions() {
  registerMonacoFormattingEditorActions({
    monaco,
    monacoEditor,
    t: i18next.t.bind(i18next),
    getCurrentTab: () => currentTab,
    keepOpenNoteTab,
    toggleTabPinned,
    toggleWordWrap,
  });
}
registerMonacoFormattingActions();

let currentDecorations = [];
let decorationFrameId = null;
const DECORATION_BUFFER_LINES = 100;
const DECORATION_MATCHERS = [/^#\s[^#]/, /^##\s[^#]/, /^###\s[^#]/, /^-#\s[^#]/, /^>\s/];

function getDecorationLineRanges(model) {
  const visibleRanges = monacoEditor.getVisibleRanges();
  const lineCount = model.getLineCount();

  if (!visibleRanges.length) {
    return [{ startLineNumber: 1, endLineNumber: lineCount }];
  }

  const expandedRanges = visibleRanges
    .map((range) => ({
      startLineNumber: Math.max(1, range.startLineNumber - DECORATION_BUFFER_LINES),
      endLineNumber: Math.min(lineCount, range.endLineNumber + DECORATION_BUFFER_LINES),
    }))
    .sort((a, b) => a.startLineNumber - b.startLineNumber);

  const mergedRanges = [];
  for (const range of expandedRanges) {
    const lastRange = mergedRanges.at(-1);
    if (!lastRange || range.startLineNumber > lastRange.endLineNumber + 1) {
      mergedRanges.push(range);
      continue;
    }

    lastRange.endLineNumber = Math.max(lastRange.endLineNumber, range.endLineNumber);
  }

  return mergedRanges;
}

function isInsideCodeBlockBeforeLine(model, lineNumber) {
  let insideCodeBlock = false;

  for (let i = 1; i < lineNumber; i++) {
    const trimmed = model.getLineContent(i).trimStart();
    if (trimmed.startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
    }
  }

  return insideCodeBlock;
}

function applyDecorations() {
  if (decorationFrameId !== null) {
    cancelAnimationFrame(decorationFrameId);
    decorationFrameId = null;
  }

  const model = monacoEditor.getModel();
  if (!model) return;

  if (!settings.syntaxHighlight) {
    currentDecorations = monacoEditor.deltaDecorations(currentDecorations, []);
    return;
  }

  const decorations = [];

  if (model.getLanguageId() !== "monapad") {
    currentDecorations = monacoEditor.deltaDecorations(currentDecorations, []);
    return;
  }

  const lineRanges = getDecorationLineRanges(model);

  for (const range of lineRanges) {
    let insideCodeBlock = isInsideCodeBlockBeforeLine(model, range.startLineNumber);

    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      const line = model.getLineContent(lineNumber);
      const trimmed = line.trimStart();
      const leadingSpaces = line.length - trimmed.length;

      if (trimmed.startsWith("```")) {
        insideCodeBlock = !insideCodeBlock;
        continue;
      }

      if (insideCodeBlock) continue;

      for (const regex of DECORATION_MATCHERS) {
        const match = trimmed.match(regex);
        if (match) {
          const markerLength = match[0].length;
          const startColumn = leadingSpaces + 1;
          const endColumn = startColumn + markerLength - 1;

          decorations.push({
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            options: { inlineClassName: "marker-transparent" },
          });

          break;
        }
      }
    }
  }

  currentDecorations = monacoEditor.deltaDecorations(currentDecorations, decorations);
}

function scheduleApplyDecorations() {
  if (decorationFrameId !== null) return;

  decorationFrameId = requestAnimationFrame(() => {
    decorationFrameId = null;
    applyDecorations();
  });
}

function getCurrentEditorText() {
  if (!currentTab) return "";
  if (monacoEditor && monacoEditor.getModel() === currentTab.model) {
    return monacoEditor.getValue();
  }
  return currentTab.model?.getValue() ?? currentTab.content ?? "";
}

deviceShareController = createDeviceShareController({
  i18next,
  electronAPI: window.electronAPI,
  getCSSVar,
  getCurrentEditorText,
  getSharePayload: () => ({
    title: currentTab?.name || "Monapad Note",
    text: getCurrentEditorText(),
  }),
  focusEditor: () => monacoEditor?.focus(),
  setModalDisplayed: (visible) => {
    isModalDisplayed = visible;
  },
});

function isNoteContentSaved(tab, content = null) {
  if (!tab?.isNote) return false;
  const nextContent = content ?? tab.model?.getValue?.() ?? tab.content ?? "";
  return normalizeTextForModelComparison(nextContent) === normalizeTextForModelComparison(tab.originalContent);
}

function createAutosaveId() {
  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `w${myWindowId || "pending"}_${id}`;
}

function getTabAutosaveKey(tab) {
  if (!tab) return null;
  if (tab.isNote) return tab.noteId ? `note:${tab.noteId}` : tab.draftId ? `pending-note:${tab.draftId}` : null;
  if (tab.path) return `file:${tab.path}`;
  return tab.draftId ? `draft:${tab.draftId}` : null;
}

function getDefaultNoteTitle() {
  return i18next.t("note.defaultTitle", { defaultValue: i18next.t("sidePanel.newNote", { defaultValue: "New Note" }) });
}

function getDefaultNewTabType({ invert = false } = {}) {
  const baseType = settings.defaultNewTabType === "note" ? "note" : "untitled";
  if (!invert) return baseType;
  return baseType === "note" ? "untitled" : "note";
}

function isDefaultNewTabNote() {
  return getDefaultNewTabType() === "note";
}

function updateNewTabShortcutLabels() {
  const newTabShortcut = document.querySelector("#newTabBtn .shortcut");
  const newNoteShortcut = document.querySelector("#newNoteBtn .shortcut");
  if (newTabShortcut) newTabShortcut.textContent = isDefaultNewTabNote() ? "Ctrl + Alt + T" : "Ctrl + T";
  if (newNoteShortcut) newNoteShortcut.textContent = isDefaultNewTabNote() ? "Ctrl + T" : "Ctrl + Alt + T";
}

function getNoteTitleFromContent(content) {
  const firstTextLine = String(content || "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return truncateNoteTitle(firstTextLine || getDefaultNoteTitle());
}

function contentHasHeading(content) {
  let inCodeBlock = false;
  for (const line of String(content || "").split(/\r\n|\r|\n/)) {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && /^\s*#{1,3}\s[^#]/.test(line)) return true;
  }
  return false;
}

function updateTabTitleDisplay(tab) {
  const nameSpan = tab?.element?.querySelector(".name");
  if (!nameSpan) return;
  nameSpan.textContent = tab.isNote ? getDisplayNoteTitle(tab.name) : tab.name;
  nameSpan.title = tab.name;
}

function updateTabHeadingIcon(tab, content = null) {
  const fileIcon = tab?.element?.querySelector(".file-icon");
  if (!fileIcon) return;
  const canShowHeadingIcon = Boolean(tab?.isNote) || /\.txt$/i.test(tab?.path || tab?.name || "");
  const nextContent = content ?? tab?.model?.getValue() ?? tab?.content ?? "";
  const hasHeadingIcon = canShowHeadingIcon && contentHasHeading(nextContent);
  fileIcon.classList.toggle("has-heading", hasHeadingIcon);
  if (hasHeadingIcon) fileIcon.title = i18next.t("sidePanel.foldableStructureIcon");
  else fileIcon.removeAttribute("title");
}

function updateNoteTabTitle(tab, content = null) {
  if (!tab?.isNote) return;
  const title = truncateNoteTitle(getNoteTitleFromContent(content ?? tab.model?.getValue() ?? tab.content ?? ""));
  tab.name = title;
  tab.noteTitle = title;
  updateTabTitleDisplay(tab);
  updateTabHeadingIcon(tab, content);
}

function isTabModelDisposed(tab) {
  return Boolean(tab?.model?.isDisposed?.());
}

function markPendingSelfSave(tab, content) {
  if (!tab || !tab.path) return;
  if (tab._pendingSelfSaveTimer) clearTimeout(tab._pendingSelfSaveTimer);
  tab._pendingSelfSaveContent = content;
  tab._pendingSelfSaveTimer = setTimeout(() => {
    tab._pendingSelfSaveContent = null;
    tab._pendingSelfSaveTimer = null;
  }, 1500);
}

function clearPendingSelfSave(tab) {
  if (!tab) return;
  if (tab._pendingSelfSaveTimer) clearTimeout(tab._pendingSelfSaveTimer);
  tab._pendingSelfSaveTimer = null;
  tab._pendingSelfSaveContent = null;
}

function isPendingSelfSaveContent(tab, content) {
  if (!tab || typeof tab._pendingSelfSaveContent !== "string") return false;
  return normalizeTextForModelComparison(content) === normalizeTextForModelComparison(tab._pendingSelfSaveContent);
}

function acceptSelfSaveFileChange(tab, content, fileInfo = null) {
  tab.originalContent = content;
  tab.content = content;
  tab.isFileSaved = true;
  tab.isWarned = false;
  updateExternalFileSnapshot(tab, content, fileInfo);
  applyFileEncodingInfo(tab, fileInfo);
  updateTabHeadingIcon(tab, content);
  clearPendingSelfSave(tab);
  tab.element.querySelector(".name")?.classList.remove("warn");
  tab.element.querySelector(".close")?.classList.remove("show-unsaved");
  reloadButton(tab, null, "remove");
  if (tab === currentTab) updateStatusBar();
}

async function readFileWithEncodingInfo(filePath) {
  const result =
    typeof window.electronAPI.readFileWithEncoding === "function"
      ? await window.electronAPI.readFileWithEncoding(filePath)
      : await window.electronAPI.readFile(filePath);
  return normalizeFileReadResult(result);
}

function applyFileEncodingInfo(tab, fileInfo = null) {
  if (!tab) return;
  tab.sourceEncoding = fileInfo?.encoding || "UTF-8";
  tab.isUtf8Valid = fileInfo?.isUtf8Valid !== false;
  tab.hasUtf8Bom = Boolean(fileInfo?.hasBom);
  if (tab === currentTab) updateStatusBar();
}

function updateExternalFileSnapshot(tab, content, fileInfo = null) {
  if (!tab) return;
  tab._lastExternalContent = content;
  tab._lastExternalHasBom = Boolean(fileInfo?.hasBom);
  tab._lastExternalIsUtf8Valid = fileInfo?.isUtf8Valid !== false;
}

function isSameExternalFileSnapshot(tab, content, fileInfo = null) {
  if (!tab || content !== tab._lastExternalContent) return false;
  return (
    Boolean(fileInfo?.hasBom) === Boolean(tab._lastExternalHasBom) &&
    (fileInfo?.isUtf8Valid !== false) === (tab._lastExternalIsUtf8Valid !== false)
  );
}

async function refreshTabEncodingInfoFromDisk(tab) {
  if (!tab?.path) return null;
  const fileInfo = await readFileWithEncodingInfo(tab.path);
  if (!fileInfo) return null;
  applyFileEncodingInfo(tab, fileInfo);
  if (tab === currentTab) updateStatusBar();
  return fileInfo;
}

function getFileSaveOptions(tab, { preserveBom = true } = {}) {
  return {
    bom: Boolean(preserveBom && tab?.hasUtf8Bom),
  };
}

async function writeNoteTab(tab, content = null, force = false) {
  if (!tab?.isNote) return false;
  const nextContent = content ?? tab.model?.getValue() ?? tab.content ?? "";

  if (!tab.noteId) {
    if (tab._pendingNoteCreatePromise) return await tab._pendingNoteCreatePromise;

    if (!nextContent.trim()) {
      tab.content = nextContent;
      tab.originalContent = "";
      tab.isFileSaved = true;
      tab.noteDirty = false;
      updateNoteTabTitle(tab, nextContent);
      return true;
    }

    tab._pendingNoteCreatePromise = (async () => {
      updateNoteTabTitle(tab, nextContent);
      const result = await window.electronAPI.createNote({
        content: nextContent,
        title: tab.noteTitle || getNoteTitleFromContent(nextContent),
        folderPath: tab.noteFolderPath || getCurrentNotesFolderPath(),
      });
      if (!result?.success) return false;

      applyNoteDataToTab(tab, { ...result, content: nextContent }, nextContent, { preview: tab.isNotePreview });
      const liveContent = tab.model?.getValue() ?? tab.content ?? nextContent;
      if (liveContent !== nextContent) {
        tab.content = liveContent;
        tab.noteDirty = true;
        updateNoteTabTitle(tab, liveContent);
        scheduleTabAutosave(tab, liveContent);
      }
      if (tab === currentTab) {
        currentFilePath = `Note: ${tab.name}`;
        updateStatusBar();
      }
      if (!tab.isNotePreview) updateRecentNote(tab.noteId);
      savePinnedTabsState();
      renderNotesList();
      return true;
    })();

    try {
      return await tab._pendingNoteCreatePromise;
    } catch (error) {
      console.warn("Failed to create note:", error);
      return false;
    } finally {
      tab._pendingNoteCreatePromise = null;
    }
  }

  if (!force && !tab.noteDirty && isNoteContentSaved(tab, nextContent)) return true;

  updateNoteTabTitle(tab, nextContent);
  try {
    const result = await window.electronAPI.writeNote({
      noteId: tab.noteId,
      title: tab.noteTitle,
      content: nextContent,
    });
    if (!result?.success) return false;

    tab.notePath = result.path || tab.notePath;
    tab.noteUpdatedAt = result.meta?.updatedAt || Date.now();
    tab.noteCreatedAt = result.meta?.createdAt || tab.noteCreatedAt;
    tab.originalContent = nextContent;
    tab.content = nextContent;
    tab.isFileSaved = true;
    tab.noteDirty = false;
    const close = tab.element?.querySelector(".close");
    if (close) close.classList.remove("show-unsaved");
    updatePinnedTabIcon(tab);
    if (tab === currentTab) updateStatusBar();
    savePinnedTabsState();
    renderNotesList();
    return true;
  } catch (error) {
    console.warn("Failed to write note:", error);
    return false;
  }
}

async function deleteNoteTabStorage(tab) {
  if (!tab?.isNote) return;
  clearAutosaveTimer(tab);
  if (!tab.noteId) return;
  try {
    await window.electronAPI.deleteNote(tab.noteId);
    renderNotesList();
  } catch (error) {
    console.warn("Failed to delete empty note:", error);
  }
}

function getReusableEmptyTab({ includeNotes = false } = {}) {
  if (tabData.length !== 1) return null;
  const tab = tabData[0];
  if (tab.path || tab.isWarned || tab.isPinned) return null;
  if (tab.isNote && !includeNotes) return null;
  const content =
    monacoEditor && tab === currentTab ? monacoEditor.getValue() : (tab.model?.getValue() ?? tab.content ?? "");
  return content.trim() ? null : tab;
}

async function prepareReusableEmptyTabForReplacement(tab) {
  if (!tab) return;
  if (tab.isNote) {
    await deleteNoteTabStorage(tab);
  } else {
    await deleteTabAutosave(tab);
  }

  tab.isNote = false;
  tab.isNotePreview = false;
  tab.noteId = null;
  tab.notePath = null;
  tab.noteFolderPath = null;
  tab.noteTitle = null;
  tab.noteCreatedAt = null;
  tab.noteUpdatedAt = null;
  tab.noteDirty = false;
  tab.draftId = null;
  tab.element?.classList.remove("note", "preview");
  updateActiveNoteListItem();
}

function setNoteTabPreview(tab, preview) {
  if (!tab?.isNote) return;
  tab.isNotePreview = Boolean(preview);
  tab.element?.classList.toggle("preview", tab.isNotePreview);
}

function keepOpenNoteTab(tab = currentTab) {
  if (!tab?.isNotePreview) return false;
  setNoteTabPreview(tab, false);
  updateRecentNote(tab.noteId);
  if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, tab);
  scheduleGlobalSearchAfterTabSetChange();
  return true;
}

function applyNoteDataToTab(tab, note, content, options = {}) {
  const title = truncateNoteTitle(note?.meta?.title || getNoteTitleFromContent(content));
  tab.isNote = true;
  tab.noteId = note.id;
  tab.notePath = note.path;
  tab.noteFolderPath = note.meta?.folderPath || "";
  tab.noteTitle = title;
  tab.noteCreatedAt = note.meta?.createdAt || Date.now();
  tab.noteUpdatedAt = note.meta?.updatedAt || Date.now();
  tab.noteDirty = false;
  tab.draftId = null;
  tab.path = null;
  tab.name = title;
  tab.content = content;
  tab.originalContent = content;
  tab.isFileSaved = true;
  tab.isWarned = false;
  tab.isMarkdown = false;
  tab._lastExternalContent = null;
  tab.element.classList.add("note");
  setNoteTabPreview(tab, Boolean(options.preview));
  tab.element.querySelector(".name")?.classList.remove("warn");
  tab.element.querySelector(".close")?.classList.remove("show-unsaved");
  reloadButton(tab, null, "remove");
  updateNoteTabTitle(tab, content);
}

function applyPendingNoteDataToTab(tab, content = "", options = {}) {
  const title = getNoteTitleFromContent(content);
  tab.isNote = true;
  tab.noteId = null;
  tab.notePath = null;
  tab.noteFolderPath = options.folderPath || getCurrentNotesFolderPath();
  tab.noteTitle = title;
  tab.noteCreatedAt = null;
  tab.noteUpdatedAt = null;
  tab.noteDirty = Boolean(String(content || "").trim());
  if (!tab.draftId) tab.draftId = createAutosaveId();
  tab.path = null;
  tab.name = title;
  tab.content = content;
  tab.originalContent = "";
  tab.isFileSaved = true;
  tab.isWarned = false;
  tab.isMarkdown = false;
  tab._lastExternalContent = null;
  tab.element.classList.add("note");
  setNoteTabPreview(tab, Boolean(options.preview));
  tab.element.querySelector(".name")?.classList.remove("warn");
  tab.element.querySelector(".close")?.classList.remove("show-unsaved");
  reloadButton(tab, null, "remove");
  updateNoteTabTitle(tab, content);
}

function clearAutosaveTimer(tab) {
  const key = getTabAutosaveKey(tab);
  if (!key) return;

  const timer = autosaveTimers.get(key);
  if (!timer) return;

  clearTimeout(timer.debounceId);
  if (timer.forceId) clearTimeout(timer.forceId);
  autosaveTimers.delete(key);
}

function shouldAutosaveTab(tab, content = null) {
  if (!tab || tab._autosaveDisabled || isTabModelDisposed(tab)) return false;
  const nextContent = content ?? tab.model?.getValue() ?? tab.content ?? "";
  if (tab.isNote) {
    if (!nextContent.trim()) return false;
    return !tab.noteId || !isNoteContentSaved(tab, nextContent);
  }
  if (!nextContent.trim()) return false;
  if (!hasUnsavedChanges(tab, nextContent)) return false;
  return new Blob([nextContent]).size <= AUTOSAVE_MAX_ITEM_BYTES;
}

async function writeTabAutosave(tab, content = null) {
  if (!tab || isTabModelDisposed(tab)) {
    clearAutosaveTimer(tab);
    return;
  }
  const nextContent = content ?? tab.model?.getValue() ?? tab.content ?? "";
  if (!shouldAutosaveTab(tab, nextContent)) return;

  try {
    if (tab.isNote) {
      await writeNoteTab(tab, nextContent, true);
    } else if (tab.path) {
      await window.electronAPI.writeAutosave({
        kind: "file",
        filePath: tab.path,
        name: tab.name,
        index: tabData.indexOf(tab),
        ownerId: myWindowId,
        content: nextContent,
      });
    } else {
      if (!tab.draftId) tab.draftId = createAutosaveId();
      await window.electronAPI.writeAutosave({
        kind: "draft",
        draftId: tab.draftId,
        name: tab.name,
        index: tabData.indexOf(tab),
        ownerId: myWindowId,
        content: nextContent,
      });
    }
    tab._autosaveStatus = "saved";
    tab._autosaveBackedUpContent = nextContent;
  } catch (error) {
    tab._autosaveStatus = "error";
    console.warn("Failed to write autosave:", error);
  } finally {
    if (tab === currentTab) updateStatusBar();
  }
}

function scheduleTabAutosave(tab, content = null) {
  if (!tab || isTabModelDisposed(tab)) {
    clearAutosaveTimer(tab);
    return;
  }
  const key = getTabAutosaveKey(tab);
  if (!key) return;
  const existingTimer = autosaveTimers.get(key);

  if (!shouldAutosaveTab(tab, content)) {
    clearAutosaveTimer(tab);
    if (tab === currentTab) updateStatusBar();
    return;
  }

  if (existingTimer?.debounceId) clearTimeout(existingTimer.debounceId);
  tab._autosaveStatus = "pending";
  if (tab === currentTab) updateStatusBar();

  const debounceId = setTimeout(async () => {
    const timer = autosaveTimers.get(key);
    if (timer?.forceId) clearTimeout(timer.forceId);
    autosaveTimers.delete(key);
    await writeTabAutosave(tab);
  }, AUTOSAVE_DEBOUNCE_MS);

  const forceId =
    existingTimer?.forceId ||
    setTimeout(async () => {
      const timer = autosaveTimers.get(key);
      if (!timer) return;
      clearTimeout(timer.debounceId);
      autosaveTimers.delete(key);
      await writeTabAutosave(tab);
    }, AUTOSAVE_FORCE_MS);

  autosaveTimers.set(key, { debounceId, forceId });
}

function scheduleAllUnsavedTabAutosaves() {
  for (const tab of tabData) {
    if (isTabModelDisposed(tab)) continue;
    scheduleTabAutosave(tab, tab.model?.getValue() ?? tab.content ?? "");
  }
  savePinnedTabsState();
}

async function deleteTabAutosave(tab) {
  if (!tab) return;
  clearAutosaveTimer(tab);
  tab._autosaveStatus = "none";
  tab._autosaveBackedUpContent = null;
  if (tab === currentTab) updateStatusBar();
  if (tab.isNote) return;

  try {
    if (tab.path) {
      await window.electronAPI.discardFileAutosaveBackup(tab.path);
    } else if (tab.draftId) {
      await window.electronAPI.deleteAutosaveDraft(tab.draftId);
    }
  } catch (error) {
    console.warn("Failed to delete autosave:", error);
  }
}

async function cleanupSavedTabAutosaves(tabsToCleanup = tabData) {
  for (const tab of tabsToCleanup) {
    const content = tab?.model?.getValue() ?? tab?.content ?? "";
    if (!hasUnsavedChanges(tab, content)) {
      await deleteTabAutosave(tab);
    }
  }
}

async function flushNoteTabs(tabsToFlush = tabData) {
  for (const tab of tabsToFlush) {
    if (tab?.isNote) {
      const content = tab.model?.getValue() ?? tab.content ?? "";
      if (content.trim()) {
        await writeNoteTab(tab, content, true);
      } else {
        await deleteNoteTabStorage(tab);
      }
    }
  }
}

async function restoreAutosaveDrafts() {
  if (isRestoringAutosaveDrafts) return;
  isRestoringAutosaveDrafts = true;

  try {
    const ownerId = await windowIdReady;
    const drafts = await window.electronAPI.listAutosaveDrafts({ ownerId });
    if (!Array.isArray(drafts) || drafts.length === 0) return;

    if (getReusableEmptyTab({ includeNotes: true }) === tabData[0]) {
      const emptyTab = tabData[0];
      await prepareReusableEmptyTabForReplacement(emptyTab);
      tabs.removeChild(emptyTab.element);
      emptyTab.model?.dispose();
      tabData = [];
      currentTab = null;
      layoutTabs({ animate: false });
    }

    for (const draft of drafts) {
      if (!draft?.content?.trim()) {
        await window.electronAPI.deleteAutosaveDraft(draft.id);
        continue;
      }

      let newTabData = tabData.find((tab) => tab.draftId === draft.id);
      if (!newTabData) {
        newTabData = createTab(draft.name, "", null);
        newTabData.draftId = draft.id;
      }
      newTabData.draftId = draft.id;
      applyRestoredAutosaveContent(newTabData, "", draft.content);
    }

    if (tabData.length > 0) {
      switchTab(tabData[0]);
      setTimeout(() => monacoEditor?.focus(), 0);
      showMessage("autosave-restored");
    }
  } catch (error) {
    console.warn("Failed to restore autosave drafts:", error);
  } finally {
    isRestoringAutosaveDrafts = false;
  }
}

function confirmAutosaveRestore(fileName) {
  return new Promise((resolve) => {
    if (!autosaveRestore || !autosaveRestoreYes || !autosaveRestoreNo) {
      resolve(false);
      return;
    }

    autosaveRestoreMessage.textContent = i18next.t("autosave.restoreMessage", { name: fileName });
    confirmBox.style.display = "flex";
    autosaveRestore.style.display = "flex";
    isModalDisplayed = true;

    const close = (restore) => {
      confirmBox.style.display = "none";
      autosaveRestore.style.display = "none";
      isModalDisplayed = false;
      autosaveRestoreYes.removeEventListener("click", onRestore);
      autosaveRestoreNo.removeEventListener("click", onDiscard);
      window.removeEventListener("keydown", onKeyDown);
      resolve(restore);
    };

    const onRestore = () => close(true);
    const onDiscard = () => close(false);
    const onKeyDown = (e) => {
      if (!isModalDisplayed) return;
      const key = (e.key || "").toLowerCase();
      if (e.code === "Enter" || e.code === "KeyR" || key === "r") {
        e.preventDefault();
        close(true);
      } else if (e.code === "Escape" || e.code === "KeyD" || key === "d" || key === "escape") {
        e.preventDefault();
        close(false);
      }
    };

    autosaveRestoreYes.addEventListener("click", onRestore);
    autosaveRestoreNo.addEventListener("click", onDiscard);
    window.addEventListener("keydown", onKeyDown);
  });
}

function applyRestoredAutosaveContent(tab, savedContent, restoredContent) {
  if (!tab?.model) return;

  tab._ignoreUnsavedCheck = true;
  tab.model.setValue(savedContent);
  tab.content = savedContent;
  tab.originalContent = savedContent;
  tab.isFileSaved = true;

  const fullRange = tab.model.getFullModelRange();
  tab.model.pushStackElement();
  tab.model.pushEditOperations(
    [],
    [
      {
        range: fullRange,
        text: restoredContent,
      },
    ],
    () => null,
  );
  tab.model.pushStackElement();

  const modelContent = tab.model.getValue();
  tab.content = modelContent;
  tab._ignoreUnsavedCheck = false;
  syncTabSaveState(tab, modelContent);
  scheduleTabAutosave(tab, modelContent);
}

async function getPinnedTabEntries() {
  try {
    const legacy = JSON.parse(localStorage.getItem(PINNED_TABS_STORAGE_KEY) || "[]");
    if (Array.isArray(legacy) && legacy.length > 0) {
      localStorage.removeItem(PINNED_TABS_STORAGE_KEY);
      return normalizePinnedTabEntries(legacy);
    }

    const byWindow = JSON.parse(localStorage.getItem(PINNED_TABS_WINDOW_STORAGE_KEY) || "{}");
    if (!byWindow || typeof byWindow !== "object") return [];
    const sessionId = await window.electronAPI.getAppSessionId();
    const savedSessionId = localStorage.getItem(`${PINNED_TABS_WINDOW_STORAGE_KEY}:session`);
    if (sessionId && savedSessionId !== sessionId) {
      const aggregated = normalizePinnedTabEntries(Object.values(byWindow).flat().filter(Boolean));
      localStorage.setItem(PINNED_TABS_WINDOW_STORAGE_KEY, JSON.stringify({}));
      localStorage.setItem(`${PINNED_TABS_WINDOW_STORAGE_KEY}:session`, sessionId);
      return aggregated;
    }
    const windowKey = String(myWindowId || "main");
    const entries = byWindow[windowKey] || [];
    return Array.isArray(entries) ? normalizePinnedTabEntries(entries) : [];
  } catch {
    return [];
  }
}

function getPinnedTabEntryKey(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "file" && entry.path) return `file:${String(entry.path).toLowerCase()}`;
  if (entry.type === "note" && entry.noteId) return `note:${entry.noteId}`;
  if (entry.type === "draft" && entry.draftId) return `draft:${entry.draftId}`;
  return null;
}

function normalizePinnedTabEntries(entries) {
  const seen = new Set();
  const normalized = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = getPinnedTabEntryKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(entry);
  }
  return normalized;
}

function writePinnedTabEntries(entries) {
  const windowKey = String(myWindowId || "main");
  let byWindow = {};
  try {
    byWindow = JSON.parse(localStorage.getItem(PINNED_TABS_WINDOW_STORAGE_KEY) || "{}") || {};
  } catch {
    byWindow = {};
  }
  byWindow[windowKey] = normalizePinnedTabEntries(entries);
  localStorage.setItem(PINNED_TABS_WINDOW_STORAGE_KEY, JSON.stringify(byWindow));
  window.electronAPI.getAppSessionId?.().then((sessionId) => {
    if (sessionId) localStorage.setItem(`${PINNED_TABS_WINDOW_STORAGE_KEY}:session`, sessionId);
  });
}

function getPersistablePinnedTabEntry(tab) {
  if (!tab?.isPinned) return null;
  const content = tab.model?.getValue() ?? tab.content ?? "";
  if (tab.isNote && tab.noteId && content.trim()) return { type: "note", noteId: tab.noteId };
  if (tab.path) return { type: "file", path: tab.path };
  if (!tab.path && !tab.isNote && tab.draftId && content.trim())
    return { type: "draft", draftId: tab.draftId, name: tab.name };
  return null;
}

function savePinnedTabsState() {
  const entries = tabData.map(getPersistablePinnedTabEntry).filter(Boolean);
  writePinnedTabEntries(entries);
}

function savePinnedTabsStateForDiscard() {
  const entries = tabData
    .filter((tab) => tab.isPinned)
    .map((tab) => {
      if (tab.isNote && tab.noteId) {
        const content = tab.model?.getValue() ?? tab.content ?? "";
        return content.trim() ? { type: "note", noteId: tab.noteId } : null;
      }
      if (tab.path) return { type: "file", path: tab.path };
      return null;
    })
    .filter(Boolean);
  writePinnedTabEntries(entries);
}

function updatePinnedTabIcon(tab) {
  if (!tab?.element) return;
  const close = tab.element.querySelector(".close");
  if (!close) return;
  close.querySelector(".pin-svg")?.remove();
  if (!tab.isPinned) return;

  const pinSvg = document.createElement("div");
  pinSvg.className = `pin-svg codicon ${tab.isFileSaved ? "codicon-pinned" : "codicon-pinned-dirty dirty"}`;
  const label = i18next.t("tabMenu.unpin");
  pinSvg.title = label;
  pinSvg.setAttribute("aria-label", label);
  close.appendChild(pinSvg);
}

function tabHasUnsavedContent(tab) {
  if (!tab || tab.isNote) return false;
  const content = tab === currentTab ? monacoEditor?.getValue() : (tab.model?.getValue() ?? tab.content ?? "");
  return hasUnsavedChanges(tab, content);
}

function replaceModelContentPreservingUndo(tab, content) {
  if (!tab?.model) return "";
  const nextContent = content ?? "";
  const currentValue = tab.model.getValue();
  if (currentValue === nextContent) return currentValue;

  const fullRange = tab.model.getFullModelRange();
  tab.model.pushStackElement();
  tab.model.pushEditOperations(
    [],
    [
      {
        range: fullRange,
        text: nextContent,
      },
    ],
    () => null,
  );
  tab.model.pushStackElement();
  return tab.model.getValue();
}

function isTabControlTarget(target) {
  return Boolean(target?.closest?.(".close, .reload-button"));
}

function setTabPinned(tab, pinned, options = {}) {
  if (!tab) return false;
  const nextPinned = Boolean(pinned);
  if (tab.isPinned === nextPinned && !options.force) return false;
  if (nextPinned && tab.isNotePreview) keepOpenNoteTab(tab);
  const targetPinnedIndex = nextPinned ? getPinnedTabCount() : null;
  tab.isPinned = nextPinned;
  tab.element?.classList.toggle("pinned", nextPinned);
  updatePinnedTabIcon(tab);
  if (nextPinned && !options.skipMove) moveTabToIndex(tab, targetPinnedIndex);
  if (!nextPinned && !options.skipMove)
    moveTabToIndex(tab, tabData.filter((candidate) => candidate !== tab && candidate.isPinned).length);
  if (!options.skipNormalize) normalizePinnedTabs();
  savePinnedTabsState();
  if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, tab);
  if (!options.skipMove) scheduleGlobalSearchAfterTabSetChange();
  return true;
}

function toggleTabPinned(tab = currentTab) {
  if (!tab) return false;
  return setTabPinned(tab, !tab.isPinned);
}

function getPinnedTabCount() {
  return tabData.filter((tab) => tab.isPinned).length;
}

function clampUnpinnedTabInsertIndex(insertIndex) {
  if (insertIndex === null || insertIndex === undefined) return insertIndex;
  return Math.max(getPinnedTabCount(), Math.min(insertIndex, tabData.length));
}

function syncTabDomOrderToData() {
  for (const tab of tabData) {
    if (tab.element?.parentElement === tabs) tabs.appendChild(tab.element);
  }
}

function normalizePinnedTabs() {
  const orderedTabs = [...tabData.filter((tab) => tab.isPinned), ...tabData.filter((tab) => !tab.isPinned)];
  const changed = orderedTabs.some((tab, index) => tabData[index] !== tab);
  if (changed) tabData = orderedTabs;
  syncTabDomOrderToData();
  for (const tab of tabData) {
    tab.element?.classList.toggle("pinned", Boolean(tab.isPinned));
    updatePinnedTabIcon(tab);
  }
  updateTabAdjacencyClasses();
  layoutTabs({ animate: true });
  savePinnedTabsState();
}

async function restorePinnedTabs() {
  const entries = await getPinnedTabEntries();
  if (entries.length === 0) return;

  const emptyInitialTab = Boolean(getReusableEmptyTab({ includeNotes: true }));
  const initialEmptyTab = emptyInitialTab ? tabData[0] : null;

  for (const entry of entries) {
    let tab = null;
    if (entry?.type === "file" && entry.path) {
      const before = [...tabData];
      await loadFileByPath(entry.path, getPinnedTabCount(), { skipRecent: true });
      tab =
        tabData.find((candidate) => candidate.path === entry.path && !before.includes(candidate)) ||
        tabData.find((candidate) => candidate.path === entry.path);
    } else if (entry?.type === "note" && entry.noteId) {
      const note = await window.electronAPI.readNote(entry.noteId);
      if (note?.exists) tab = await createNoteTab(note.content || "", getPinnedTabCount(), note, { preview: false });
    } else if (entry?.type === "draft" && entry.draftId) {
      tab = createTab(entry.name || null, "", null, getPinnedTabCount());
      tab.draftId = entry.draftId;
    }
    if (tab) setTabPinned(tab, true, { skipMove: true, skipNormalize: true, force: true });
  }

  if (
    initialEmptyTab &&
    tabData.length > 1 &&
    tabData.includes(initialEmptyTab) &&
    !initialEmptyTab.isPinned &&
    !initialEmptyTab.path &&
    !initialEmptyTab.model?.getValue()?.trim()
  ) {
    await prepareReusableEmptyTabForReplacement(initialEmptyTab);
    tabs.removeChild(initialEmptyTab.element);
    initialEmptyTab.model?.dispose();
    tabData = tabData.filter((tab) => tab !== initialEmptyTab);
    if (currentTab === initialEmptyTab) currentTab = null;
    layoutTabs({ animate: false });
  }

  normalizePinnedTabs();
  if (tabData.length) switchTab(tabData[0]);
}

function updateDeviceShareButtonState() {
  deviceShareController?.updateButtonState();
}

function updateCurrentTabStatusBar() {
  if (currentTab) updateStatusBar();
}

// detect change in editor
monacoEditor.onDidChangeModelContent(() => {
  const active = currentTab;
  if (!active || monacoEditor.getModel() !== active.model) return;

  const currentContent = monacoEditor.getValue();
  active.content = currentContent;
  updateTabHeadingIcon(active, currentContent);

  // use active._ignoreUnsavedCheck = ture before monacoEditor.getValue() when this process is unnecessary
  if (active._ignoreUnsavedCheck) {
    active._ignoreUnsavedCheck = false;
    return;
  }

  if (active.isNotePreview) keepOpenNoteTab(active);
  syncTabSaveState(active, currentContent);
  if (active.isNote && !active.noteId && currentContent.trim()) writeNoteTab(active, currentContent, true);
  scheduleTabAutosave(active, currentContent);

  updateStatusBar();
  updateDeviceShareButtonState();
  scheduleApplyDecorations();
  if (isGlobalSearchActive()) scheduleGlobalSearch();
});
monacoEditor.onDidScrollChange(() => {
  scheduleApplyDecorations();
});
applyDecorations();

// prevent monaco error that occurs when try to delete all selection includes folding
monacoEditor.onKeyDown((e) => {
  const code = e.browserEvent.code;
  if (code !== "Delete" && code !== "Backspace") return;

  const model = monacoEditor.getModel();
  const sel = monacoEditor.getSelection();
  const full = model.getFullModelRange();

  const isFull =
    sel.startLineNumber === full.startLineNumber &&
    sel.startColumn === full.startColumn &&
    sel.endLineNumber === full.endLineNumber &&
    sel.endColumn === full.endColumn;

  if (!isFull) return;

  // check if folding exists
  const foldingController = monacoEditor.getContribution("editor.contrib.folding");
  foldingController?.foldingModelPromise.then((fm) => {
    if (!fm) return;
    const hasCollapsed = Array.from({ length: fm.regions.length }).some((_, i) => fm.regions.isCollapsed(i));
    if (hasCollapsed) {
      e.preventDefault();
      e.stopPropagation();

      const act = monacoEditor.getAction("editor.unfoldAll");
      if (act) {
        act.run().then(() => {
          const selection = monacoEditor.getSelection();
          if (selection && !selection.isEmpty()) {
            monacoEditor.executeEdits("deleteAfterUnfold", [
              {
                range: selection,
                text: "", // delete
              },
            ]);
          }
        });
      }
    }
  });
});

// font dropdown
const fontDropdown = new CustomSelect(fontFamilySelect, {
  searchEnabled: true,
  combobox: true,
  shouldSort: false,
  position: "bottom",
  onBeforeOpen() {
    closeContextMenus({ focus: false });
  },
  renderOption(choice) {
    const preview = document.createElement("span");
    preview.dataset.fontPreview = choice.value;
    preview.textContent = choice.label;
    if (loadedFontPreviewNames.has(choice.value)) {
      preview.style.fontFamily = getFontPreviewFamily(choice.value);
      preview.dataset.fontPreviewApplied = "true";
    }
    return preview;
  },
});
let fontPreviewFrameId = null;
let fontPreviewScrollTimer = null;
let fontPreviewSearchTimer = null;
const loadedFontPreviewNames = new Set();

function getFontPreviewFamily(fontName) {
  return `"${fontName.replace(/"/g, '\\"')}", "Figtree", sans-serif`;
}

// scroll to bottom of settings menu whenever langSwitcher dropdown is shown
function scrollToBottomOfSettingsMenu() {
  requestAnimationFrame(() => {
    settingsMenu.scrollTop = settingsMenu.scrollHeight;
    requestAnimationFrame(() => {
      settingsMenu.scrollTop = settingsMenu.scrollHeight;
    });
  });
}

// scroll to selected item on top of menu list
function scrollToSelectedOption(selectInstance) {
  const container = selectInstance.containerOuter.element;
  container
    .querySelectorAll(".custom-select__item.is-highlighted")
    .forEach((el) => el.classList.remove("is-highlighted"));

  const selectedOption = container.querySelector(".custom-select__item.is-selected");
  if (selectedOption) {
    const list = selectedOption.closest(".custom-select__list");
    if (list) list.scrollTop = selectedOption.offsetTop;
    requestAnimationFrame(() => {
      selectedOption.classList.add("is-highlighted");
    });
  }
}

function getFontDropdown() {
  return fontDropdown.containerOuter.element.querySelector(".custom-select__dropdown");
}

function applyVisibleFontPreviews() {
  fontPreviewFrameId = null;

  const dropdown = getFontDropdown();
  if (!dropdown || !dropdown.classList.contains("is-active")) return;

  const dropdownRect = dropdown.getBoundingClientRect();
  if (dropdownRect.width <= 0 || dropdownRect.height <= 0) return;

  const previewSpans = dropdown.querySelectorAll("[data-font-preview]:not([data-font-preview-applied])");
  for (const span of previewSpans) {
    const item = span.closest(".custom-select__item");
    if (!item) continue;

    const itemRect = item.getBoundingClientRect();
    const isVisible = itemRect.bottom > dropdownRect.top && itemRect.top < dropdownRect.bottom;
    if (!isVisible) continue;

    const fontName = span.dataset.fontPreview;
    if (!fontName) continue;

    loadedFontPreviewNames.add(fontName);
    span.style.fontFamily = getFontPreviewFamily(fontName);
    span.dataset.fontPreviewApplied = "true";
  }
}

function scheduleVisibleFontPreviews() {
  if (fontPreviewFrameId !== null) cancelAnimationFrame(fontPreviewFrameId);
  fontPreviewFrameId = requestAnimationFrame(() => {
    applyVisibleFontPreviews();
    fontPreviewFrameId = requestAnimationFrame(applyVisibleFontPreviews);
  });
}

function bindLazyFontPreviewEvents() {
  const dropdown = getFontDropdown();
  const dropdownList = dropdown?.querySelector(".custom-select__list");
  if (!dropdown || dropdown.dataset.lazyFontPreviewBound === "true") return;

  dropdown.dataset.lazyFontPreviewBound = "true";

  dropdownList?.addEventListener("scroll", () => {
    scheduleVisibleFontPreviews();
    clearTimeout(fontPreviewScrollTimer);
    fontPreviewScrollTimer = setTimeout(scheduleVisibleFontPreviews, 80);
  });

  fontDropdown.trigger.addEventListener("input", () => {
    clearTimeout(fontPreviewSearchTimer);
    fontPreviewSearchTimer = setTimeout(() => {
      scheduleVisibleFontPreviews();
    }, 40);
  });
}

// scroll fontFamilySelect to top of settingsMenu when its dropdown is not fully inside it
function adjustDropdownScroll() {
  const scrollNow = () => {
    const dropdown = document.querySelector(".font-select-row .custom-select__dropdown");
    if (!dropdown || !fontSelectRow) return null;

    const scrollTargetY = Math.max(0, fontSelectRow.offsetTop - 5);
    settingsMenu.scrollTop = scrollTargetY;
    return scrollTargetY;
  };

  const scrollTargetY = scrollNow();
  requestAnimationFrame(() => {
    const nextScrollTargetY = scrollTargetY ?? scrollNow();
    if (nextScrollTargetY !== null) {
      settingsMenu.scrollTop = nextScrollTargetY;
      requestAnimationFrame(() => {
        settingsMenu.scrollTop = nextScrollTargetY;
      });
    }
  });
}

function onDropdownShown(event) {
  const target = event.target;

  // === Font Selector ===
  if (target === fontFamilySelect) {
    scrollToSelectedOption(fontDropdown);
    bindLazyFontPreviewEvents();

    if (scrollLocked) {
      scrollAdjustQueue.push(adjustDropdownScroll);
    } else {
      adjustDropdownScroll();
    }
    scheduleVisibleFontPreviews();
  }

  // === Language Selector ===
  else if (target === langSwitcher) {
    scrollToSelectedOption(langDropdown);

    if (scrollLocked) {
      scrollAdjustQueue.push(scrollToBottomOfSettingsMenu);
    } else {
      scrollToBottomOfSettingsMenu();
    }
  }
}
fontFamilySelect.addEventListener("showDropdown", onDropdownShown);
fontFamilySelect.addEventListener("hideDropdown", () => {
  if (fontPreviewFrameId !== null) {
    cancelAnimationFrame(fontPreviewFrameId);
    fontPreviewFrameId = null;
  }
  clearTimeout(fontPreviewScrollTimer);
  clearTimeout(fontPreviewSearchTimer);
});
langSwitcher.addEventListener("showDropdown", onDropdownShown);

// get font using font-list and apply on launch
window.electronAPI.getFonts().then((fonts) => {
  const bundledFonts = ["Iosevka", "Migu 1M", "Figtree"];
  const cleanedFonts = fonts.map((f) => f.trim().replace(/^"|"$/g, ""));

  bundledFonts.forEach((font) => {
    if (!cleanedFonts.includes(font)) cleanedFonts.push(font);
  });

  const sortedFonts = cleanedFonts.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  // apply to custom select
  fontDropdown.setChoices(
    sortedFonts.map((fontName) => ({
      value: fontName,
      label: fontName,
    })),
    "value",
    "label",
    true,
  );

  fontDropdown.setChoiceByValue(selectedFontFamily);
  applyFontToMonaco();
});

// apply font on change
fontFamilySelect.addEventListener("change", () => {
  selectedFontFamily = fontDropdown.getValue(true);
  localStorage.setItem("selectedFontFamily", selectedFontFamily);
  console.log(selectedFontFamily);
  updateSettingsTooltips();
  applyFontToMonaco();
});

function applyFontToMonaco() {
  const cssFont = getCSSVar("--editor-font");
  let cleanFontFamily = selectedFontFamily.replace(/^"|"$/g, "");

  const finalFont = cssFont && cssFont.trim() ? cssFont : `"${cleanFontFamily}", "Migu 1M", monospace`;

  monacoEditor.updateOptions({
    fontFamily: finalFont,
    ...WRAP_MEASURE_OPTIONS,
  });
  document.fonts.ready.then(() => {
    monaco.editor.remeasureFonts();
    monacoEditor.render(true);
  });
}

// font size button event
// font size on launch
fontSizeValue.textContent = persistentFontSize;
fontSize = persistentFontSize;

function updatePersistentFontSize(newSize) {
  if (newSize < 8) newSize = 8;
  if (newSize > 40) newSize = 40;

  persistentFontSize = newSize;
  fontSizeValue.textContent = persistentFontSize;
  localStorage.setItem(STORAGE_KEY, persistentFontSize);

  tabData.forEach((tab) => {
    tab.fontSize = persistentFontSize;
  });

  fontSize = persistentFontSize;
  monacoEditor.updateOptions({ fontSize });

  fontSizeDecrease.classList.toggle("disabled", persistentFontSize <= 8);
  fontSizeIncrease.classList.toggle("disabled", persistentFontSize >= 40);

  updateStatusBar?.();
}
updatePersistentFontSize(persistentFontSize);
fontSizeDecrease.addEventListener("click", () => {
  updatePersistentFontSize(persistentFontSize - 1);
});
fontSizeIncrease.addEventListener("click", () => {
  updatePersistentFontSize(persistentFontSize + 1);
});

// font settings reset button
document.querySelector("#settings-menu .font .reset").addEventListener("click", () => {
  // reset persistentFontSize, selectedFontFamily
  updatePersistentFontSize(16);
  selectedFontFamily = "Iosevka";
  localStorage.setItem("selectedFontFamily", selectedFontFamily);
  fontDropdown.setChoiceByValue(selectedFontFamily);
  updateSettingsTooltips();
  applyFontToMonaco();
});

// update font size with ctrl + mouse wheel / + - (temporary)
const updateFontSize = (newSize) => {
  fontSize = Math.max(8, Math.min(40, newSize));
  monacoEditor.updateOptions({ fontSize });
  if (currentTab) currentTab.fontSize = fontSize;
  updateStatusBar();
};

// Ctrl + mouse wheel
function attachCtrlWheelListener() {
  const editorDomNode = monacoEditor.getDomNode();
  if (!editorDomNode) return;
  const scrollElement = editorDomNode.querySelector(".monaco-scrollable-element");
  if (!scrollElement) return;

  // remove last listner
  if (wheelListener) {
    scrollElement.removeEventListener("wheel", wheelListener);
  }

  wheelListener = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      updateFontSize(fontSize + (e.deltaY < 0 ? 1 : -1));
    }
  };

  scrollElement.addEventListener("wheel", wheelListener, { passive: false });
}

// Ctrl + + / -
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      updateFontSize(fontSize + 1);
    } else if (e.key === "-") {
      e.preventDefault();
      updateFontSize(fontSize - 1);
    } else if (e.key === "0") {
      e.preventDefault();
      updateFontSize(persistentFontSize); // reset with ctrl + 0
    }
  }
});

// editor settings
function applySettings() {
  monacoEditor.updateOptions({
    renderLineHighlight: settings.lineHighlight ? "line" : "none",
    lineNumbers: settings.lineNumbers ? "on" : "off",
    minimap: {
      enabled: settings.minimap,
    },
    folding: settings.folding,
  });
  updateEditorLeftMargin();

  document.querySelector("#line-highlight .checkmark").style.display = settings.lineHighlight ? "inline-flex" : "none";
  document.querySelector("#line-num .checkmark").style.display = settings.lineNumbers ? "inline-flex" : "none";
  document
    .querySelector("#minimap .checkmark")
    ?.style?.setProperty("display", settings.minimap ? "inline-flex" : "none");
  document.querySelector("#toggleSyntaxHighlight .checkmark").style.display = settings.syntaxHighlight
    ? "inline-flex"
    : "none";
  document.querySelector("#toggleFolding .checkmark").style.display = settings.folding ? "inline-flex" : "none";
  document.querySelector("#toggleKuromoji .checkmark").style.display = settings.kuromojiEnabled
    ? "inline-flex"
    : "none";
  document.querySelector("#default-new-tab-note .checkmark").style.display = isDefaultNewTabNote()
    ? "inline-flex"
    : "none";
  updateNewTabShortcutLabels();

  // status bar visibility
  const statusBar = document.getElementById("status-bar");
  const checkmark = document.querySelector("#toggleStatusBar .checkmark");
  if (settings.statusBarVisible) {
    document.body.classList.add("status-bar-visible");
    statusBar.style.display = "flex";
    checkmark.style.display = "inline-flex";
    editor.style.height = "calc(100vh - 35px - 25px - var(--window-top-safe-area))";
    settingsMenu.style.height = "calc(100vh - 35px - 25px - var(--window-top-safe-area))";
  } else {
    document.body.classList.remove("status-bar-visible");
    statusBar.style.display = "none";
    checkmark.style.display = "none";
    editor.style.height = "calc(100vh - 35px - var(--window-top-safe-area))";
    settingsMenu.style.height = "calc(100vh - 35px - var(--window-top-safe-area))";
  }

  if (monacoEditor) {
    setTimeout(() => monacoEditor.layout(), 0);
  }
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  localStorage.setItem("editorSettings", JSON.stringify(settings));
  applySettings();
}
applySettings();

document.getElementById("line-highlight").onclick = () => toggleSetting("lineHighlight");
document.getElementById("line-num").onclick = () => toggleSetting("lineNumbers");
document.getElementById("minimap").onclick = () => toggleSetting("minimap");
document.getElementById("toggleSyntaxHighlight").onclick = () => {
  toggleSetting("syntaxHighlight");
  monaco.editor.defineTheme("custom-theme", createCustomTheme());
  monaco.editor.setTheme("custom-theme");
  applyDecorations();
};
document.getElementById("toggleFolding").onclick = () => toggleSetting("folding");
document.getElementById("toggleStatusBar").onclick = () => toggleSetting("statusBarVisible");
document.getElementById("toggleKuromoji").onclick = () => {
  toggleSetting("kuromojiEnabled");
  setKuromojiEnabled(settings.kuromojiEnabled);
};
document.getElementById("default-new-tab-note").onclick = () => {
  settings.defaultNewTabType = isDefaultNewTabNote() ? "untitled" : "note";
  localStorage.setItem("editorSettings", JSON.stringify(settings));
  applySettings();
};

// editor settings reset button
document.querySelector("#settings-menu #settingsLayout .reset").addEventListener("click", () => {
  // reset settings, tabSize
  Object.assign(settings, defaultSettings);
  localStorage.setItem("editorSettings", JSON.stringify(settings));

  tabSize = 4;
  localStorage.setItem("tabSize", tabSize);

  applySettings();
  updateTabSize(tabSize);
});

// tab size button event
// tab size on launch
tabSizeValue.textContent = tabSize;
monacoEditor.updateOptions({ tabSize });

function updateTabSize(newSize) {
  tabSize = Math.min(10, Math.max(1, newSize));
  tabSizeValue.textContent = tabSize;
  localStorage.setItem("tabSize", tabSize);
  monacoEditor.updateOptions({ tabSize });

  tabSizeDecrease.classList.toggle("disabled", tabSize <= 1);
  tabSizeIncrease.classList.toggle("disabled", tabSize >= 10);

  updateStatusBar?.();
}
updateTabSize(tabSize);
tabSizeDecrease.addEventListener("click", () => updateTabSize(tabSize - 1));
tabSizeIncrease.addEventListener("click", () => updateTabSize(tabSize + 1));

// open custom theme folder button
document.getElementById("openThemeFolder").addEventListener("click", async () => {
  try {
    const userDataPath = await window.electronAPI.getUserDataPath();
    const themeFolderPath = `${userDataPath}/themes`;
    await window.electronAPI.openPath(themeFolderPath);
    console.log("themes path opened:", themeFolderPath);
  } catch (err) {
    console.error("Failed to open path:", err);
  }
});

// initial editor theme
monaco.editor.setTheme("custom-theme");

// update ln & col
monacoEditor.onDidChangeCursorPosition(() => {
  updateStatusBar();
});
monacoEditor.onDidChangeCursorSelection(() => {
  updateStatusBar();
});

// call Find from menu
function triggerFind() {
  monacoEditor.getAction("actions.find").run();
}
window.triggerFind = triggerFind;
document.getElementById("triggerFindBtn").addEventListener("click", triggerFind);

// call Replace from menu
function triggerReplace() {
  monacoEditor.getAction("editor.action.startFindReplaceAction").run();
}
window.triggerReplace = triggerReplace;
document.getElementById("triggerReplaceBtn").addEventListener("click", triggerReplace);

// call Go to Line from menu
function triggerGoToLine() {
  monacoEditor?.focus();
  monacoEditor.getAction("editor.action.gotoLine").run();
}
window.triggerGoToLine = triggerGoToLine;
document.getElementById("triggerGoToLineBtn").addEventListener("click", triggerGoToLine);

// call Go to Symbol from menu
function triggerGoToSymbol() {
  monacoEditor?.focus();
  monacoEditor.getAction("editor.action.quickOutline").run();
}
window.triggerGoToSymbol = triggerGoToSymbol;
document.getElementById("triggerGoToSymbolBtn").addEventListener("click", triggerGoToSymbol);

// call Quick Open from menu
function triggerQuickOpen() {
  openQuickOpenPicker();
}
window.triggerQuickOpen = triggerQuickOpen;
document.getElementById("triggerQuickOpenBtn").addEventListener("click", triggerQuickOpen);

// call Command Palette from menu
function triggerShowCommands() {
  monacoEditor?.focus();
  monacoEditor.trigger("keyboard", "editor.action.quickCommand", {});
}
window.triggerShowCommands = triggerShowCommands;
document.getElementById("triggerShowCommandsBtn").addEventListener("click", triggerShowCommands);

function registerMonacoQuickInputActions() {
  registerMonacoQuickInputEditorActions({
    monaco,
    monacoEditor,
    t: i18next.t.bind(i18next),
    openQuickOpenPicker,
    triggerShowCommands,
  });
}

registerMonacoQuickInputActions();

let activeQuickOpenPicker = null;

function getQuickOpenNoteTitle(note) {
  return truncateNoteTitle(note?.title || getDefaultNoteTitle());
}

function getQuickOpenNotePathLabel(note) {
  const root = i18next.t("monaco.quickOpen.notes");
  const folderPath = String(note?.folderPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("\\");
  return folderPath ? `${root}\\${folderPath}` : root;
}

function getNoteStatusPath(tab) {
  const folderParts = String(tab?.noteFolderPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  return ["Notes", ...folderParts, tab?.name || getDefaultNoteTitle()].join("\\");
}

function createQuickOpenFileItem(filePath, sourceRank) {
  const label = getPathBasename(filePath);
  return {
    label: `$(file) ${label}`,
    description: filePath,
    tooltip: filePath,
    ariaLabel: `${label} ${filePath}`,
    kind: "file",
    path: filePath,
    sourceRank,
  };
}

function createQuickOpenNoteItem(note, sourceRank) {
  const title = getQuickOpenNoteTitle(note);
  const pathLabel = getQuickOpenNotePathLabel(note);
  return {
    label: `$(list-flat) ${title}`,
    description: pathLabel,
    tooltip: `${title} ${pathLabel}`,
    ariaLabel: `${title} ${pathLabel}`,
    iconClasses: ["monapad-quick-open-note"],
    kind: "note",
    noteId: note.id,
    sourceRank,
  };
}

async function getQuickOpenItems() {
  const recent = getRecentHistoryEntries();
  const notes = sortNotesForPanel(await window.electronAPI.listNotes());
  notesIndexCache = notes;
  const notesById = new Map(notes.filter((note) => note?.id).map((note) => [note.id, note]));
  const items = [];
  const seenFiles = new Set();
  const seenNotes = new Set();

  const pushFile = (filePath, sourceRank) => {
    if (!filePath || seenFiles.has(filePath)) return;
    seenFiles.add(filePath);
    items.push(createQuickOpenFileItem(filePath, sourceRank));
  };
  const pushNote = (note, sourceRank) => {
    if (!note?.id || seenNotes.has(note.id)) return;
    seenNotes.add(note.id);
    items.push(createQuickOpenNoteItem(note, sourceRank));
  };

  for (const entry of recent) {
    if (entry.type === "note") {
      pushNote(notesById.get(entry.noteId), 0);
    } else if (entry.type === "file" && entry.path) {
      let exists = entry.exists !== false;
      if (exists) {
        try {
          exists = await window.electronAPI.fileExists(entry.path);
        } catch {
          exists = false;
        }
      }
      if (exists) pushFile(entry.path, 0);
    }
  }

  tabData.forEach((tab) => {
    if (tab?.path) {
      pushFile(tab.path, 1);
    } else if (tab?.isNote && tab.noteId) {
      pushNote(notesById.get(tab.noteId) || { id: tab.noteId, title: tab.name, folderPath: tab.noteFolderPath }, 1);
    }
  });

  notes.forEach((note) => pushNote(note, 2));
  return items;
}

async function openQuickOpenPicker() {
  monacoEditor?.focus();
  activeQuickOpenPicker?.hide();

  const quickInputService = StandaloneServices.get(IQuickInputService);
  const picker = quickInputService?.createQuickPick?.({ useSeparators: false });
  if (!picker) {
    StandaloneServices.get(IQuickInputService)?.quickAccess?.show("");
    return;
  }

  activeQuickOpenPicker = picker;
  picker.placeholder = i18next.t("monaco.quickOpen.placeholder");
  picker.matchOnDescription = true;
  picker.sortByLabel = true;
  picker.busy = true;
  picker.show();

  picker.onDidHide(() => {
    if (activeQuickOpenPicker === picker) activeQuickOpenPicker = null;
    picker.dispose();
  });

  picker.onDidAccept(async () => {
    const item = picker.selectedItems?.[0] || picker.activeItems?.[0];
    if (!item || item.pickable === false) return;
    picker.hide();
    if (item.kind === "note") {
      await openNoteById(item.noteId, { preview: false });
    } else if (item.kind === "file") {
      await loadFileByPath(item.path);
    }
  });

  const items = await getQuickOpenItems();
  if (activeQuickOpenPicker !== picker) return;
  picker.busy = false;
  picker.items = items.length
    ? items
    : [
        {
          label: i18next.t("monaco.quickOpen.noResults"),
          pickable: false,
        },
      ];
  picker.activeItems = items.length ? [items[0]] : [];
}

// initial tab create
createDefaultEmptyTab({ switchTo: false });
switchTab(tabData[0]);
setTimeout(() => monacoEditor?.focus(), 0);

(async () => {
  await windowIdReady;
  await restorePinnedTabs();
  await restoreAutosaveDrafts();
})();

function getStoredSidePanelOpen() {
  return localStorage.getItem(SIDE_PANEL_OPEN_STORAGE_KEY) === "true";
}

function getStoredSidePanelWidth() {
  const stored = Number(localStorage.getItem(SIDE_PANEL_WIDTH_STORAGE_KEY));
  return Number.isFinite(stored)
    ? clampNumber(stored, SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH)
    : SIDE_PANEL_DEFAULT_WIDTH;
}

function setSidePanelWidth(width, options = {}) {
  const nextWidth = clampNumber(Number(width), SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH);
  if (!Number.isFinite(nextWidth)) return getSidePanelWidth();
  document.documentElement.style.setProperty("--side-panel-width", `${nextWidth}px`);
  updateEditorLeftMargin();
  monacoEditor?.layout();
  if (options.persist) localStorage.setItem(SIDE_PANEL_WIDTH_STORAGE_KEY, String(Math.round(nextWidth)));
  return nextWidth;
}

function setSidePanelOpen(open, options = {}) {
  const nextOpen = Boolean(open);
  const wasOpen = document.body.classList.contains("side-panel-open");
  if (wasOpen === nextOpen && !options.force) {
    sidePanel?.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    if (options.persist !== false) localStorage.setItem(SIDE_PANEL_OPEN_STORAGE_KEY, String(nextOpen));
    return;
  }
  document.body.classList.toggle("side-panel-open", nextOpen);
  sidePanel?.setAttribute("aria-hidden", nextOpen ? "false" : "true");
  if (options.persist !== false) localStorage.setItem(SIDE_PANEL_OPEN_STORAGE_KEY, String(nextOpen));
  updateEditorLeftMargin();
  updateGlobalSearchActionState();
  if (nextOpen) {
    closeContextMenus({ focus: false });
    renderNotesList();
    menu.style.display = "none";
    themeMenu.style.display = "none";
    recentMenu.style.display = "none";
    setMenuButtonsPointerEvents("auto");
  }
  setTimeout(() => monacoEditor?.layout(), 190);
}

function getSidePanelWidth() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--side-panel-width");
  const width = parseFloat(value);
  return Number.isFinite(width) ? width : SIDE_PANEL_DEFAULT_WIDTH;
}

function updateEditorLeftMargin() {
  const lineNumberOffset = settings.lineNumbers ? 20 : 0;
  const panelOffset = document.body.classList.contains("side-panel-open") ? getSidePanelWidth() : 0;
  document.documentElement.style.setProperty("--editor-line-number-offset", `${lineNumberOffset}px`);
  document.documentElement.style.setProperty("--editor-side-panel-offset", `${panelOffset}px`);
  editor.style.marginLeft = `${lineNumberOffset + panelOffset}px`;
}

function toggleSidePanel() {
  setSidePanelOpen(!document.body.classList.contains("side-panel-open"));
}

function openGlobalSearchPanel() {
  setSidePanelOpen(true);
  requestAnimationFrame(() => {
    globalSearchInput?.focus();
    globalSearchInput?.select();
  });
}

setSidePanelWidth(getStoredSidePanelWidth(), { persist: false });
setSidePanelOpen(getStoredSidePanelOpen(), { force: true, persist: false });

function startSidePanelResize(e) {
  if (!sidePanel || e.button !== 0 || !document.body.classList.contains("side-panel-open")) return;
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startWidth = getSidePanelWidth();
  let latestWidth = startWidth;
  let resizeFrame = null;

  document.body.classList.add("side-panel-resizing");
  document.body.style.cursor = "w-resize";

  const applyResize = () => {
    resizeFrame = null;
    setSidePanelWidth(latestWidth);
  };

  const onMouseMove = (moveEvent) => {
    latestWidth = clampNumber(startWidth + moveEvent.clientX - startX, SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH);
    if (resizeFrame === null) resizeFrame = requestAnimationFrame(applyResize);
  };

  const finishResize = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", finishResize);
    document.body.classList.remove("side-panel-resizing");
    document.body.style.cursor = "";
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = null;
    }
    setSidePanelWidth(latestWidth, { persist: true });
    monacoEditor?.layout();
    scheduleGlobalSearchFilePathUpdate();
    scheduleGlobalSearchPreviewUpdate();
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", finishResize, { once: true });
}

sidePanelResizeHandle?.addEventListener("mousedown", startSidePanelResize);

window.addEventListener(
  "keydown",
  (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === "KeyF")) return;
    e.preventDefault();
    e.stopPropagation();
    openGlobalSearchPanel();
  },
  true,
);

function toggleMainMenuFromButton(e) {
  e.stopPropagation();
  if (menuButtonDragOpenedPanel) {
    menuButtonDragOpenedPanel = false;
    return;
  }
  closeContextMenus({ focus: false });
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  setMenuButtonsPointerEvents(isOpen ? "auto" : "none");
}

function setMenuButtonsPointerEvents(value) {
  menuButton.style.pointerEvents = value;
  sidePanelMenuButton.style.pointerEvents = value;
}

toggleSidePanelBtn.addEventListener("click", (e) => {
  e.preventDefault();
  setSidePanelOpen(true);
});

sidePanelClose.addEventListener("click", () => {
  setSidePanelOpen(false);
  monacoEditor?.focus();
});

notesAddButton?.addEventListener("click", async () => {
  await createNewNote();
});

foldersAddButton?.addEventListener("click", () => {
  notesController?.createFolderDraft();
});

notesListRefreshButton?.addEventListener("click", async () => {
  await refreshNotesListNow();
});

// menu button
menuButton.onclick = toggleMainMenuFromButton;
sidePanelMenuButton.onclick = toggleMainMenuFromButton;

const NOTES_PANEL_DRAG_THRESHOLD = 42;
let menuButtonDragStart = null;
let menuButtonDragOpenedPanel = false;

menuButton.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  menuButtonDragStart = { x: e.clientX, y: e.clientY };
  menuButtonDragOpenedPanel = false;
});

window.addEventListener("mousemove", (e) => {
  if (!menuButtonDragStart || menuButtonDragOpenedPanel) return;
  const dx = e.clientX - menuButtonDragStart.x;
  const dy = Math.abs(e.clientY - menuButtonDragStart.y);
  if (dx >= NOTES_PANEL_DRAG_THRESHOLD && dy < 40) {
    menuButtonDragOpenedPanel = true;
    setSidePanelOpen(true);
  }
});

window.addEventListener("mouseup", () => {
  menuButtonDragStart = null;
  if (menuButtonDragOpenedPanel) {
    setTimeout(() => {
      menuButtonDragOpenedPanel = false;
    }, 0);
  }
});

// close menu & context menu on outside click
document.addEventListener("mousedown", (e) => {
  if (e.target.closest(".custom-select")) return;
  if (e.target.closest("#menu-button, #side-panel-menu-button")) {
    closeContextMenus({ focus: false });
    return;
  }
  if (!customContextMenu.contains(e.target)) {
    customContextMenu.style.display = "none";
  }
  if (noteContextMenu && !noteContextMenu.contains(e.target)) {
    notesController?.closeContextMenu();
  }
  if (!tabContextMenu.contains(e.target)) {
    tabContextMenu.style.display = "none";
    rightClickedTab = null;
  }
  if (!menu.contains(e.target) && !themeMenu.contains(e.target) && !recentMenu.contains(e.target)) {
    menu.style.display = "none";
    themeMenu.style.display = "none";
    recentMenu.style.display = "none";
    setMenuButtonsPointerEvents("auto");
  }
});

// close menu & context menu on button click
document.addEventListener("click", (e) => {
  const button = e.target.closest("button");

  // context menu
  if (customContextMenu.contains(e.target) && button) {
    customContextMenu.style.display = "none";
  }
  if (tabContextMenu.contains(e.target) && button) {
    tabContextMenu.style.display = "none";
    rightClickedTab = null;
  }
  if (noteContextMenu?.contains(e.target) && button && !button.dataset.edge) {
    notesController?.closeContextMenu();
  }

  // themeMenu & menu (except for cetain buttons)
  if (menu.contains(e.target) && button && !excludedIds.includes(button.id)) {
    menu.style.display = "none";
    setMenuButtonsPointerEvents("auto");
  }

  // recentMenu menu
  if (recentMenu.contains(e.target) && button) {
    recentMenu.style.display = "none";
    menu.style.display = "none";
    setMenuButtonsPointerEvents("auto");
  }
});

// close menu & context menu on right click
document.addEventListener("contextmenu", (e) => {
  const button = e.target.closest("button");
  const isExcluded = button && excludedIds.includes(button.id);
  const insideTheme = themeMenu.contains(e.target);

  if (!isExcluded && !insideTheme) {
    menu.style.display = "none";
    themeMenu.style.display = "none";
    recentMenu.style.display = "none";
    setMenuButtonsPointerEvents("auto");
  }
});

// update theme & recent menu y position
function updateMenuPositions() {
  const changeBtnRect = changeThemeBtn.getBoundingClientRect();
  const recentBtnRect = openRecentBtn.getBoundingClientRect();

  const topTheme = changeBtnRect.top - 5;
  const topRecent = recentBtnRect.top - 5;

  themeMenu.style.top = `${topTheme}px`;
  themeMenu.style.maxHeight = `${window.innerHeight - topTheme}px`;

  recentMenu.style.top = `${topRecent}px`;
  recentMenu.style.maxHeight = `${window.innerHeight - topRecent}px`;
}
window.addEventListener("resize", () => {
  updateMenuPositions();
  updateTabsCompactClass();
  scheduleGlobalSearchPreviewUpdate();
  scheduleGlobalSearchFilePathUpdate();

  // update editor padding
  const editorHeight = editor.clientHeight;
  monacoEditor.updateOptions({
    padding: {
      top: 12,
      bottom: editor.clientHeight / 2,
    },
  });
});
window.addEventListener("wheel", updateMenuPositions, { passive: true });

// recent menu display
let recentMenuHoverSeq = 0;

function shouldKeepRecentMenuOpen() {
  return menu.style.display === "block" && (openRecentBtn.matches(":hover") || recentMenu.matches(":hover"));
}

openRecentBtn.addEventListener("mouseenter", async () => {
  const hoverSeq = ++recentMenuHoverSeq;
  const displayCount = await populateRecentMenu();
  if (hoverSeq === recentMenuHoverSeq && displayCount > 0 && shouldKeepRecentMenuOpen()) {
    recentMenu.style.display = "inline-block";
    updateMenuPositions();
  }
});
openRecentBtn.addEventListener("mouseleave", () => {
  recentMenuHoverSeq++;
  setTimeout(() => {
    if (!shouldKeepRecentMenuOpen()) {
      recentMenu.style.display = "none";
    }
  }, 100);
});
recentMenu.addEventListener("mouseleave", () => {
  recentMenuHoverSeq++;
  setTimeout(() => {
    if (!shouldKeepRecentMenuOpen()) {
      recentMenu.style.display = "none";
    }
  }, 100);
});

// theme menu display
changeThemeBtn.addEventListener("mouseenter", () => {
  themeMenu.style.display = "block";
  updateMenuPositions();
});
changeThemeBtn.addEventListener("mouseleave", () => {
  setTimeout(() => {
    if (!themeMenu.matches(":hover") && !changeThemeBtn.matches(":hover")) {
      themeMenu.style.display = "none";
    }
  }, 100);
});
themeMenu.addEventListener("mouseleave", () => {
  setTimeout(() => {
    if (!themeMenu.matches(":hover") && !changeThemeBtn.matches(":hover")) {
      themeMenu.style.display = "none";
    }
  }, 100);
});

async function applyCustomThemeCSS(themeName, knownThemes = null) {
  const themes = knownThemes || (await window.electronAPI.getCustomThemes());
  const filePath = themes[themeName];

  if (currentWatchedCssFile && currentWatchedCssFile !== filePath) {
    window.electronAPI.unwatchCssFile(currentWatchedCssFile);
  }

  if (filePath) {
    try {
      const cssContent = await window.electronAPI.readCssFile(filePath);
      if (cssContent) {
        const existingStyle = document.getElementById("custom-theme-style");
        if (existingStyle) existingStyle.remove();

        const styleTag = document.createElement("style");
        styleTag.id = "custom-theme-style";
        styleTag.textContent = cssContent;
        document.head.appendChild(styleTag);

        currentWatchedCssFile = filePath;
        window.electronAPI.watchCssFile(filePath); // start watching file

        return true;
      }
    } catch (error) {
      console.error("Failed to apply custom theme:", error);
    }
  }

  console.log("Theme not found:", themeName);
  return false;
}

function cssColorToHex(value) {
  const color = String(value || "").trim();
  if (/^#[\da-f]{3}$/i.test(color) || /^#[\da-f]{6}$/i.test(color)) return color;
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return `#${match
    .slice(1, 4)
    .map((part) =>
      Math.max(0, Math.min(255, Number(part)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function updateTitleBarOverlayColors() {
  const styles = getComputedStyle(document.documentElement);
  const color = cssColorToHex(styles.getPropertyValue("--color1")) || "#000000";
  const symbolColor = cssColorToHex(styles.getPropertyValue("--grayOut")) || "#565b66";
  window.electronAPI.setTitleBarOverlay?.({ color, symbolColor });
}

async function applyTheme(theme) {
  const root = document.documentElement;
  const isDefaultTheme = isDefaultThemeName(theme);
  const themes = isDefaultTheme ? null : await window.electronAPI.getCustomThemes();

  // set to dark if custom theme file doesn't exist
  if (!isDefaultTheme && !themes[theme]) {
    theme = "dark";
    currentTheme = "dark";
    localStorage.setItem("theme", theme);
  }

  // override with custom theme if selected
  if (!isDefaultThemeName(theme)) {
    // Set default fallback colors (dark) for custom themes. hence !important is required in css.
    root.style.setProperty("--color1", "#121214");
    root.style.setProperty("--color2", "#1a1a1e");
    root.style.setProperty("--color3", "#242429");
    const success = await applyCustomThemeCSS(theme, themes);
    if (!success) {
      updateTitleBarOverlayColors();
      root.classList.remove("booting-custom-theme");
      return;
    }
  } else {
    // delete style tag
    const existingStyle = document.getElementById("custom-theme-style");
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  if (theme === "dark") {
    root.style.setProperty("--color1", "#121214");
    root.style.setProperty("--color2", "#1a1a1e");
    root.style.setProperty("--color3", "#242429");
  } else if (theme === "onyx") {
    root.style.setProperty("--color1", "#000000");
    root.style.setProperty("--color2", "#0c0c0e");
    root.style.setProperty("--color3", "#18181a");
  } else if (theme === "ash") {
    root.style.setProperty("--color1", "#232428");
    root.style.setProperty("--color2", "#292b31");
    root.style.setProperty("--color3", "#36393f");
  }

  monaco.editor.defineTheme("custom-theme", createCustomTheme());
  monaco.editor.setTheme("custom-theme");
  updateTitleBarOverlayColors();
  root.classList.remove("booting-custom-theme");
}

// theme button click & update button checkmark
function updateActiveButton() {
  const allThemeButtons = themeMenu.querySelectorAll("button[data-theme]");
  allThemeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-theme") === currentTheme);
  });
}

// theme button click event
function attachThemeButtonEvents() {
  const allThemeButtons = themeMenu.querySelectorAll("button[data-theme]");
  allThemeButtons.forEach((btn) => {
    btn.removeEventListener("click", handleThemeButtonClick);
    btn.addEventListener("click", handleThemeButtonClick);
  });
}

async function handleThemeButtonClick(event) {
  const theme = event.currentTarget.getAttribute("data-theme");
  currentTheme = theme;
  localStorage.setItem("theme", theme);
  await applyTheme(theme);
  applyFontToMonaco();
  updateActiveButton();
}

// load custom theme and add to menu
async function addCustomThemesToMenu() {
  const customThemes = await window.electronAPI.getCustomThemes();
  const themeNames = Object.keys(customThemes);

  if (themeNames.length > 0) {
    const hr = document.createElement("div");
    hr.className = "hr";
    themeMenu.appendChild(hr);

    themeNames.forEach((themeName) => {
      // snake-case -> "Title Case"
      const displayName = themeName
        .replace(/[-_/]+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

      const button = document.createElement("button");
      button.dataset.theme = themeName;
      button.innerHTML = `<span>${displayName}</span><span class="checkmark codicon codicon-check"></span>`;
      themeMenu.appendChild(button);
    });

    attachThemeButtonEvents();
    updateActiveButton();
  }
}

await applyTheme(currentTheme);
await addCustomThemesToMenu(); // load custom theme first
updateActiveButton();
attachThemeButtonEvents();

// apply css file update
window.electronAPI.onCssFileUpdated(async (path) => {
  if (currentWatchedCssFile === path && currentTheme) {
    console.log("Detected CSS update, reapplying theme...");
    await applyTheme(currentTheme);
    applyFontToMonaco();
  }
});

document.getElementById("openFileBtn").addEventListener("click", openFile);
document.getElementById("saveFileBtn").addEventListener("click", saveFile);
document.getElementById("saveAsFileBtn").addEventListener("click", saveAsFile);
saveAsNoteBtn.addEventListener("click", saveAsNote);

// print button
// document.getElementById("print-button").addEventListener("click", () => {
//   const content = monacoEditor.getValue();
//   const fontFamily = monacoEditor.getRawOptions().fontFamily || "Consolas";
//   window.electronAPI.printContent({ text: content, fontFamily });
// });

// about button
function closeAboutModal() {
  confirmBox.style.display = "none";
  about.style.display = "none";
  isModalDisplayed = false;
  monacoEditor?.focus();
}

document.getElementById("aboutBtn").addEventListener("click", () => {
  confirmBox.style.display = "flex";
  about.style.display = "flex";
  isModalDisplayed = true;
});

document.getElementById("about-close").addEventListener("click", closeAboutModal);

// window controls
document.getElementById("min-button")?.addEventListener("click", () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById("max-button")?.addEventListener("click", () => {
  window.electronAPI.toggleMaximizeWindow();
});

document.getElementById("close-button")?.addEventListener("click", () => {
  attemptCloseWindow();
});

window.electronAPI.onAttemptCloseWindow(() => {
  attemptCloseWindow();
});

// add tab (+) button
addTabButton.onclick = async (e) => {
  createDefaultEmptyTab({ invert: e.shiftKey });
};
// new tab button
newTabBtn.addEventListener("click", (e) => {
  e.preventDefault();
  createDefaultEmptyTab();
});
newNoteBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await createNewNote();
});

// tabs hover state
tabsContainer.addEventListener("mouseover", (e) => {
  tabAreaHovered = true;
  startTabHoverMouseWatcher();

  const hoveredTab = e.target.closest(".tab");
  if (hoveredTab) {
    const allTabs = tabs.querySelectorAll(".tab");
    isHoveringLastTab = hoveredTab === allTabs[allTabs.length - 1];
  } else {
    isHoveringLastTab = false;
  }
});
function handleTabsMouseLeave() {
  if (draggingTab) return;
  tabAreaHovered = false;
  isHoveringLastTab = false;
  stopTabHoverMouseWatcher();
  clearTabClosingModeAvailableWidth();
  layoutTabs({ animate: true });
  updateTabsCompactClass();
}
function isMouseInsideTabsContainer() {
  const rect = tabsContainer.getBoundingClientRect();
  const addTabRect = addTabButton.getBoundingClientRect();
  return (
    mouseX >= rect.left &&
    mouseX <= addTabRect.right &&
    mouseY >= rect.top &&
    mouseY <= rect.bottom + TAB_VERTICAL_DETACH_MAGNETISM
  );
}
function updateMousePositionFromScreenPoint(point) {
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
  mouseX = point.x - window.screenX;
  mouseY = point.y - window.screenY;
}
function startTabHoverMouseWatcher() {
  if (tabHoverMouseWatcherTimer !== null) return;
  tabHoverMouseWatcherTimer = setInterval(async () => {
    if (!tabAreaHovered || draggingTab || tabHoverMouseWatcherBusy) return;
    tabHoverMouseWatcherBusy = true;
    try {
      updateMousePositionFromScreenPoint(await window.electronAPI.getCursorScreenPoint());
      if (tabAreaHovered && !isMouseInsideTabsContainer()) handleTabsMouseLeave();
    } catch {
      // Ignore transient native cursor lookup failures; renderer events still act as fallback.
    } finally {
      tabHoverMouseWatcherBusy = false;
    }
  }, 50);
}
function stopTabHoverMouseWatcher() {
  if (tabHoverMouseWatcherTimer === null) return;
  clearInterval(tabHoverMouseWatcherTimer);
  tabHoverMouseWatcherTimer = null;
  tabHoverMouseWatcherBusy = false;
}
tabsContainer.addEventListener("mouseleave", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (!isMouseInsideTabsContainer()) handleTabsMouseLeave();
});
// detect if cursor is in tabsContainer even without cursor movement
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (tabAreaHovered && !isMouseInsideTabsContainer()) handleTabsMouseLeave();
});

// new window button
newWindowBtn.addEventListener("click", () => {
  window.electronAPI.createNewWindow();
});

// file drag & drop
window.addEventListener("dragenter", (e) => {
  if (isModalDisplayed) return;
  if (!e.dataTransfer.types.includes("Files")) return;

  dragCounter++;
  if (dragCounter === 1) {
    fileDropBox.style.display = "flex";
    fileDrop.style.display = "flex";
  }
});

window.addEventListener("dragleave", (e) => {
  if (isModalDisplayed) return;
  dragCounter = Math.max(0, dragCounter - 1);

  if (dragCounter === 0) {
    fileDropBox.style.display = "none";
    fileDrop.style.display = "none";
  }
});

window.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragCounter = 0;

  fileDropBox.style.display = "none";
  fileDrop.style.display = "none";

  if (!e.dataTransfer.files.length || isModalDisplayed) return;

  const file = e.dataTransfer.files[0];
  const filePath = await window.electronAPI.getPathForFile(file);
  if (filePath) await loadFileByPath(filePath);
});

window.addEventListener("dragover", (e) => {
  e.preventDefault(); // prevent default to allow drop
  if (isModalDisplayed) {
    e.dataTransfer.dropEffect = "none";
  } else {
    e.dataTransfer.dropEffect = "copy";
  }
});

// update status bar
function updateStatusBar() {
  if (!monacoEditor) return;

  const position = monacoEditor.getPosition();
  const model = monacoEditor.getModel();
  const eol = model.getEOL();
  const currentEncoding = currentTab?.sourceEncoding || "UTF-8";
  const isEncodingValid = currentTab?.isUtf8Valid !== false;

  let lineEnding = "Unknown";
  if (eol === "\r\n") {
    lineEnding = "CRLF";
  } else if (eol === "\n") {
    lineEnding = "LF";
  } else if (eol === "\r") {
    lineEnding = "CR";
  }

  const selections = monacoEditor.getSelections();
  let totalSelectedLength = 0;
  if (selections && selections.length > 0) {
    totalSelectedLength = selections.reduce((sum, sel) => sum + model.getValueLengthInRange(sel), 0);
  }

  const selectionText =
    totalSelectedLength > 0 ? ` ${i18next.t("statusBar.selection", { count: totalSelectedLength })}` : "";
  const positionText =
    selections?.length > 1
      ? i18next.t("statusBar.selectionCount", { count: selections.length })
      : `${i18next.t("statusBar.line")} ${position.lineNumber}, ${i18next.t("statusBar.col")} ${position.column}`;

  if (currentTab?.isNote) {
    const updated = formatNoteUpdatedAt(currentTab.noteUpdatedAt);
    const notePath = getNoteStatusPath(currentTab);
    const noteStatus = updated ? `${updated} • ${notePath}` : notePath;
    if (statusPathEl) statusPathEl.textContent = noteStatus;
    if (statusPathEl) statusPathEl.title = notePath;
  } else {
    if (statusPathEl) statusPathEl.textContent = currentFilePath;
    if (statusPathEl) statusPathEl.title = currentFilePath;
  }
  statusLeft.title = "";
  const hasFileNotFound = Boolean(currentTab?.path && currentTab?.isWarned);
  const hasExternalModified = Boolean(currentTab?.path && currentTab?.element?.classList.contains("has-reload-button"));
  const hasExternalWarning = hasFileNotFound || hasExternalModified;
  if (statusExternalWarningEl) {
    statusExternalWarningEl.textContent = i18next.t(
      hasFileNotFound ? "statusBar.fileNotFound" : "statusBar.externalModified",
    );
    statusExternalWarningEl.title = i18next.t(hasFileNotFound ? "message.fileNotFound" : "message.fileModified");
  }
  statusLeft?.classList.toggle("has-external-warning", hasExternalWarning);
  updateSaveStatus();
  updateBackupStatus();
  lineColEl.textContent = `${positionText}${selectionText}`;
  zoomLevelEl.textContent = `${Math.round((fontSize / persistentFontSize) * 100)}%`;
  lineEndingEl.textContent = lineEnding;
  encodingEl.textContent = isEncodingValid ? currentEncoding : i18next.t("statusBar.invalidEncodingLabel");
  encodingEl.classList.toggle("warn", !isEncodingValid);
  encodingEl.title = !isEncodingValid
    ? i18next.t("statusBar.invalidEncodingTooltip")
    : currentTab?.hasUtf8Bom
      ? i18next.t("statusBar.bomEncodingTooltip")
      : i18next.t("statusBar.encodingTooltip");
}

function getTabContent(tab) {
  return tab?.model?.getValue?.() ?? tab?.content ?? "";
}

function getTabSaveStatus(tab = currentTab) {
  if (!tab) return "";
  const content = getTabContent(tab);
  if (tab.isNote) {
    if (!tab.noteId && !content.trim()) return "newNote";
    if (!tab.noteId && content.trim()) return "saving";
    return tab.noteDirty && !isNoteContentSaved(tab, content) ? "saving" : "saved";
  }
  if (!tab.path && !content.trim()) return "untitled";
  return tab.isFileSaved && !tab.isWarned ? "saved" : "modified";
}

function updateSaveStatus() {
  if (!saveStatusEl) return;
  const status = getTabSaveStatus();
  if (status === "untitled" || status === "newNote") {
    if (saveStatusFadeTimer) {
      clearTimeout(saveStatusFadeTimer);
      saveStatusFadeTimer = null;
    }
    saveStatusEl.classList.remove("is-fading");
    saveStatusEl.style.display = "none";
    saveStatusEl.innerHTML = "";
    saveStatusEl.dataset.status = status;
    delete saveStatusEl.dataset.statusHtml;
    return;
  }

  saveStatusEl.style.display = "inline-flex";
  const icon =
    status === "saved"
      ? '<span class="codicon codicon-check" aria-hidden="true"></span>'
      : status === "saving"
        ? '<span class="codicon codicon-sync" aria-hidden="true"></span>'
        : "";
  const html = `<span>${i18next.t(`statusBar.${status || "saved"}`)}</span>${icon}`;
  if (saveStatusEl.dataset.statusHtml === html) return;

  const apply = () => {
    saveStatusEl.innerHTML = html;
    saveStatusEl.dataset.statusHtml = html;
    saveStatusEl.classList.remove("is-fading");
  };

  if (!saveStatusEl.dataset.statusHtml) {
    apply();
    return;
  }

  saveStatusEl.classList.add("is-fading");
  if (saveStatusFadeTimer) clearTimeout(saveStatusFadeTimer);
  saveStatusFadeTimer = setTimeout(apply, 180);
}

function updateBackupStatus() {
  if (!backupStatusEl) return;
  const tab = currentTab;
  if (!tab || tab.isNote) {
    backupStatusEl.style.display = "none";
    backupStatusEl.innerHTML = "";
    return;
  }

  backupStatusEl.style.display = "inline-flex";
  const content = getTabContent(tab);
  let state = tab._autosaveStatus || "none";
  if (!tab.path && !content.trim()) state = "missing";
  else if (tab._autosaveStatus === "saved" && tab._autosaveBackedUpContent === content) state = "saved";
  else if (autosaveTimers.has(getTabAutosaveKey(tab))) state = "pending";
  else if (state !== "error") state = "missing";

  const stateIcon = state === "saved" ? "check" : state === "pending" ? "sync" : "close";
  const titleKey = state === "saved" ? "backupSaved" : state === "pending" ? "backupPending" : "backupMissing";
  backupStatusEl.innerHTML = `<span class="codicon codicon-database"></span><span class="codicon codicon-${stateIcon}"></span>`;
  backupStatusEl.title = i18next.t(`statusBar.${titleKey}`);
}

// drag & drop indicator when dragging tab to another window
function showDropIndicator(clientX, excludeTab = null, clampAfterPinned = false, tabForPlacement = null) {
  if (!dropIndicator) return;
  const tabsRect = tabs.getBoundingClientRect();
  const containerRect = tabsContainer.getBoundingClientRect();
  const effectiveExcludeTab = excludeTab || draggingTab;
  const visualPlacement = getTabDropPlacementByClientX(clientX, null);
  const placement = tabForPlacement
    ? clampDropPlacementForTab(visualPlacement, tabForPlacement, effectiveExcludeTab)
    : clampAfterPinned
      ? clampDropPlacementAfterPinnedTabs(visualPlacement, effectiveExcludeTab)
      : visualPlacement;
  if (!placement) {
    hideDropIndicator();
    return;
  }
  let { left } = placement;
  left = Math.max(0, Math.min(left, Math.max(tabs.getBoundingClientRect().width, getTabsIdealTrailingX())));
  const indicatorWidth = dropIndicator.offsetWidth || 2;
  const sidePanelFirstOffset = document.body.classList.contains("side-panel-open") && left === 0 ? 2 : 0;
  const centeredLeft = tabsRect.left - containerRect.left + left - indicatorWidth / 2 + sidePanelFirstOffset;
  dropIndicator.style.left = `${centeredLeft}px`;
  dropIndicator.style.display = "block";
}

function hideDropIndicator() {
  if (!dropIndicator) return;
  dropIndicator.style.display = "none";
}

function showExternalDropIndicator(screenX, screenY, excludeTab = null, tabForPlacement = null) {
  if (!dropIndicator) return;
  if (typeof screenX !== "number" || typeof screenY !== "number") {
    hideDropIndicator();
    return;
  }

  const localClientX = screenX - window.screenX;
  showDropIndicator(localClientX, excludeTab, true, tabForPlacement);
}

function resetExternalPreviewTargetWindow() {
  if (externalPreviewTargetWindowId !== null) {
    window.electronAPI.clearPreviewTabDrop(externalPreviewTargetWindowId);
    externalPreviewTargetWindowId = null;
  }
}

function setExternalPreviewTargetWindow(targetWindowId, dropScreenX, dropScreenY, tabInfo = null) {
  if (externalPreviewTargetWindowId !== null && externalPreviewTargetWindowId !== targetWindowId) {
    window.electronAPI.clearPreviewTabDrop(externalPreviewTargetWindowId);
    externalPreviewTargetWindowId = null;
  }

  if (targetWindowId && targetWindowId !== myWindowId) {
    externalPreviewTargetWindowId = targetWindowId;
    if (dropScreenX !== lastPreviewX || dropScreenY !== lastPreviewY) {
      lastPreviewX = dropScreenX;
      lastPreviewY = dropScreenY;
      window.electronAPI.previewTabDrop(targetWindowId, { dropScreenX, dropScreenY, tabInfo });
    }
    return;
  }

  lastPreviewX = null;
  lastPreviewY = null;
  resetExternalPreviewTargetWindow();
}

// tab dragging
function enableTabDragging(tab, data) {
  let tabOrderChangedDuringDrag = false;
  let dragMouseOffsetX = 0;
  let dragVisualX = null;
  let lastTabReorderMouseX = 0;
  let isDraggingOutsideToolbar = false;
  let detachedTabState = null;

  tab.addEventListener("mousedown", async (e) => {
    if (e.button !== 0 || isTabControlTarget(e.target) || draggingTab) return;
    if (isTabLayoutAnimating()) return;
    e.preventDefault();
    // console.log("📌mousedown: start");
    isHandlingMouseDown = true;
    tabPendingDeferredMouseUp = tab;
    dragStartClientPos = { x: e.clientX, y: e.clientY };
    switchTab(data);
    draggingTab = tab;
    // console.log("📌mousedown: draggingTab set");
    draggingTabData = data;
    draggingTabWasPinned = Boolean(data.isPinned);
    tab.classList.add("dragging-tab");
    tabDragOriginalOrder = [...tabData];
    tabDragOriginalActiveTab = currentTab;
    tabOrderChangedDuringDrag = false;
    document.body.classList.add("tab-dragging");
    dragIndex = tabData.indexOf(data);
    wasOnlyTab = tabData.length === 1;
    startX = e.clientX;
    currentX = 0;
    const tabsRect = tabs.getBoundingClientRect();
    const tabBounds = getCurrentTabBounds(data);
    dragMouseOffsetX = e.clientX - (tabsRect.left + tabBounds.x);
    dragVisualX = tabBounds.x;
    lastTabReorderMouseX = e.clientX;
    tab.style.transition = "none";
    externalCancelDragging = handleCancelDraggingByShortcut;
    windowBoundsCache = await window.electronAPI.getMyBounds();
    // console.log("📌mousedown: adding eventlistener...");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    // console.log("📌mousedown: eventlistener added");
    isHandlingMouseDown = false;

    // defered: only process mouseup that occur while processing current tab
    if (deferredOnMouseUp && tabPendingDeferredMouseUp === tab) {
      console.log("📌deferred onMouseUp fired after mousedown end");
      deferredOnMouseUp = false;
      tabPendingDeferredMouseUp = null;
      const e = deferredMouseUpEvent;
      deferredMouseUpEvent = null;
      onMouseUp(e);
    }
  });

  function shouldCheckWindow() {
    const now = performance.now();
    if (now - lastWindowCheck > 100) {
      lastWindowCheck = now;
      return true;
    }
    return false;
  }

  function commitDraggedTabVisualBounds() {
    if (!draggingTab || !draggingTabData || dragVisualX === null) {
      tab.style.removeProperty("--tab-drag-x");
      return;
    }
    const width = draggingTab.getBoundingClientRect().width;
    draggingTab.style.removeProperty("--tab-drag-x");
    setTabBounds(draggingTabData, { x: dragVisualX, width });
  }

  function updateDraggedTabVisualPosition(clientX) {
    dragVisualX = calculateDraggedTabVisualX(clientX);
    const baseX = parseFloat(draggingTab.style.left || "0") || 0;
    currentX = dragVisualX - baseX;
    draggingTab.style.setProperty("--tab-drag-x", `${currentX}px`);
    updateTabsWidthForDraggedTab(dragVisualX);
  }

  function calculateDraggedTabVisualX(clientX) {
    const tabsRect = tabs.getBoundingClientRect();
    const dragAreaWidth = getTabDragAreaWidth();
    const draggingWidth = draggingTab.getBoundingClientRect().width || draggingTabData?._tabBounds?.width || 0;
    return Math.max(0, Math.min(clientX - tabsRect.left - dragMouseOffsetX, Math.max(0, dragAreaWidth - draggingWidth)));
  }

  function canDetachDraggedTab() {
    return Boolean(draggingTabData) && !draggingTabData.isWarned && !draggingTabData.isPinned;
  }

  function detachDraggedTabFromStrip() {
    if (!draggingTab || !draggingTabData || detachedTabState) return;
    const index = tabData.indexOf(draggingTabData);
    if (index === -1) return;

    detachedTabState = { index };
    draggingTab.style.removeProperty("--tab-drag-x");
    currentX = 0;
    dragVisualX = null;
    setTabDragExtendedWidth(null);
    tabData.splice(index, 1);
    draggingTab.style.display = "none";
    syncTabDomOrderToData();
    tabs.appendChild(draggingTab);
    layoutTabs({ animate: true });
    updateTabAdjacencyClasses();
    dragIndex = -1;
  }

  function calculateDraggedTabInsertionIndex() {
    if (!draggingTabData || dragVisualX === null) return dragIndex;

    const draggingPinned = Boolean(draggingTabData.isPinned);
    const others = tabData.filter((candidate) => candidate !== draggingTabData);
    const minIndex = draggingPinned ? 0 : others.findIndex((candidate) => !candidate.isPinned);
    const domainStart = minIndex < 0 ? others.length : minIndex;
    const domainEnd = draggingPinned
      ? others.findIndex((candidate) => !candidate.isPinned)
      : others.length;
    const firstIndex = draggingPinned ? 0 : domainStart;
    const lastIndex = (draggingPinned && domainEnd >= 0 ? domainEnd : others.length);

    const availableWidth = getTabStripAvailableDragWidth();
    let bestIndex = firstIndex;
    let bestDistance = Infinity;

    for (let candidateIndex = firstIndex; candidateIndex <= lastIndex; candidateIndex++) {
      const candidateTabs = [...others];
      candidateTabs.splice(candidateIndex, 0, draggingTabData);
      const candidateSlots = candidateTabs.map((tab, index) => ({ tab, closing: false, index }));
      const { bounds } = calculateTabLayout(candidateSlots, availableWidth);
      const candidateBounds = bounds.get(draggingTabData);
      if (!candidateBounds) continue;

      const distance = Math.abs(dragVisualX - candidateBounds.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = candidateIndex;
      }
    }

    return bestIndex;
  }

  function insertDraggedTabAtIndex(index, clientX) {
    if (!draggingTabData) return false;
    const wasDetached = Boolean(detachedTabState);
    if (wasDetached) {
      finishTabLayoutAnimations();
      for (const animation of draggingTab.getAnimations()) animation.cancel();
    }
    const others = tabData.filter((candidate) => candidate !== draggingTabData);
    const clampedIndex = Math.max(0, Math.min(index, others.length));
    const nextTabData = [...others];
    nextTabData.splice(clampedIndex, 0, draggingTabData);

    const nextIndex = nextTabData.indexOf(draggingTabData);
    if (!wasDetached && nextIndex === dragIndex && tabData[dragIndex] === draggingTabData) {
      updateDraggedTabVisualPosition(clientX);
      return false;
    }

    tabData = nextTabData;
    syncTabDomOrderToData();
    layoutTabs({ animate: false });
    updateTabAdjacencyClasses();
    scheduleAllUnsavedTabAutosaves();
    tabOrderChangedDuringDrag = true;
    dragIndex = nextIndex;
    detachedTabState = null;
    updateDraggedTabVisualPosition(clientX);
    draggingTab.style.display = "";
    return true;
  }

  function moveDraggedTabInStrip(index, clientX) {
    if (!draggingTabData) return false;
    for (const animation of draggingTab.getAnimations()) animation.cancel();
    cancelTabLayoutAnimation(draggingTabData);
    const others = tabData.filter((candidate) => candidate !== draggingTabData);
    const clampedIndex = Math.max(0, Math.min(index, others.length));
    const nextTabData = [...others];
    nextTabData.splice(clampedIndex, 0, draggingTabData);

    const nextIndex = nextTabData.indexOf(draggingTabData);
    if (nextIndex === dragIndex && tabData[dragIndex] === draggingTabData) {
      updateDraggedTabVisualPosition(clientX);
      return false;
    }

    tabData = nextTabData;
    syncTabDomOrderToData();
    layoutTabs({ animate: true, skipTabs: new Set([draggingTabData]) });
    updateDraggedTabVisualPosition(clientX);
    updateTabAdjacencyClasses();
    scheduleAllUnsavedTabAutosaves();
    tabOrderChangedDuringDrag = true;
    dragIndex = nextIndex;
    return true;
  }

  function restoreDetachedTabToOriginalOrder(animate = true) {
    if (!draggingTabData || !detachedTabState || !tabDragOriginalOrder?.length) return false;
    draggingTab.style.display = "";
    tabData = tabDragOriginalOrder.filter(Boolean);
    syncTabDomOrderToData();
    layoutTabs({ animate });
    updateTabAdjacencyClasses();
    dragIndex = tabData.indexOf(draggingTabData);
    detachedTabState = null;
    return true;
  }

  function finalizeDraggedTabRemovalAfterExternalDrop(targetTabData, fallbackIndex) {
    const index = tabData.indexOf(targetTabData);
    const switchIndex = index === -1 ? Math.max(0, Math.min(fallbackIndex, tabData.length - 1)) : index;

    clearAutosaveTimer(targetTabData);
    if (index !== -1) tabData.splice(index, 1);
    if (targetTabData.element?.parentElement === tabs) tabs.removeChild(targetTabData.element);
    layoutTabs({ animate: true });
    scheduleAllUnsavedTabAutosaves();
    scheduleGlobalSearchAfterTabSetChange();

    const wasActive = targetTabData.element?.classList.contains("active") || currentTab === targetTabData;
    if (!wasActive) {
      updateTabAdjacencyClasses();
      return;
    }

    if (tabData.length) {
      switchTab(tabData[Math.max(0, Math.min(switchIndex, tabData.length - 1))]);
      setTimeout(() => monacoEditor?.focus(), 0);
    } else {
      currentTab = null;
      createDefaultEmptyTab({ switchTo: false });
      switchTab(tabData[0]);
      setTimeout(() => monacoEditor?.focus(), 0);
    }
  }

  function onMouseMove(e) {
    if (!draggingTab) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const isOutsideToolbar = isOutsideTabDragContext(mouseX, mouseY);

    if (isOutsideToolbar && canDetachDraggedTab()) {
      if (!isDraggingOutsideToolbar) {
        isDraggingOutsideToolbar = true;
        detachDraggedTabFromStrip();
      }
      hideDropIndicator();
      tabs.classList.remove("dragging");
      draggingTab.style.opacity = "0.5";
      overlayWindowVisible = true;
      window.electronAPI.createCursorWindow();

      if (shouldCheckWindow()) {
        const isWarn = draggingTabData.isWarned || draggingTabData.isPinned;
        getTabDragTargetWindowId(e.screenX, e.screenY).then(async (targetWindowId) => {
          if (!windowBoundsCache) {
            setExternalPreviewTargetWindow(null);
            return;
          }

          let isTargetMinimized = false;
          if (targetWindowId) {
            isTargetMinimized = await window.electronAPI.isWindowMinimized(targetWindowId);
          }

          let state = "";
          if (isWarn) {
            state = "forbidden";
          } else if (targetWindowId && !isTargetMinimized) {
            state = "move";
          } else if (wasOnlyTab) {
            state = "forbidden";
          } else {
            state = "new";
          }

          if (state === "move") {
            setExternalPreviewTargetWindow(targetWindowId, e.screenX, e.screenY, {
              isNote: draggingTabData.isNote,
              noteId: draggingTabData.noteId,
              path: draggingTabData.path,
            });
          } else {
            setExternalPreviewTargetWindow(null);
          }
          window.electronAPI.setCursorWindowState(state);
        });
      }

      scheduleCursorWindowMove(e.screenX, e.screenY);
      return;
    } else {
      tabs.classList.add("dragging");
      draggingTab.style.opacity = "1";
      overlayWindowVisible = false;
      resetCursorWindowMove();
      window.electronAPI.destroyCursorWindow();
      setExternalPreviewTargetWindow(null);
      hideDropIndicator();
      if (isDraggingOutsideToolbar) {
        isDraggingOutsideToolbar = false;
        dragVisualX = calculateDraggedTabVisualX(mouseX);
        insertDraggedTabAtIndex(calculateDraggedTabInsertionIndex(), mouseX);
        lastTabReorderMouseX = mouseX;
        return;
      }
      updateDraggedTabVisualPosition(mouseX);
    }

    const nextIndex = calculateDraggedTabInsertionIndex();
    if (nextIndex !== dragIndex) {
      const currentBounds = draggingTabData?._tabBounds || getCurrentTabBounds(draggingTabData);
      const reorderThreshold = Math.max(1, Math.round((currentBounds.width / TAB_MAX_WIDTH) * 16));
      if (Math.abs(mouseX - lastTabReorderMouseX) > reorderThreshold) {
        monacoEditor.getDomNode()?.blur();
        if (moveDraggedTabInStrip(nextIndex, mouseX)) lastTabReorderMouseX = mouseX;
      }
    }
  }

  async function onMouseUp(e) {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    // console.log("🗑️mouseup: eventlistener removed");

    if (tabPendingDeferredMouseUp === tab) {
      tabPendingDeferredMouseUp = null;
      deferredOnMouseUp = false;
      deferredMouseUpEvent = null;
    }

    if (!draggingTab || !e) {
      console.warn("⚠️ onMouseUp called with invalid state", draggingTab, e);
      draggingTab?.classList.remove("dragging-tab");
      document.body.classList.remove("tab-dragging");
      dragStartClientPos = null;
      externalCancelDragging = null;
      tabDragOriginalOrder = null;
      tabDragOriginalActiveTab = null;
      isDraggingOutsideToolbar = false;
      setTabDragExtendedWidth(null);
      return;
    }

    const releasedTabData = draggingTabData;
    const isWarn = releasedTabData.isWarned || releasedTabData.isPinned;
    const releasedDetachedState = detachedTabState;
    const releasedOriginalOrder = tabDragOriginalOrder;

    if (!releasedDetachedState) commitDraggedTabVisualBounds();
    draggingTab.classList.remove("dragging-tab");
    draggingTab.style.transition = "";
    draggingTab.style.pointerEvents = "";
    draggingTab.style.opacity = "1";
    if (!releasedDetachedState) draggingTab.style.display = "";
    tabs.classList.remove("dragging");
    document.body.classList.remove("tab-dragging");

    if (overlayWindowVisible) {
      overlayWindowVisible = false;
      resetCursorWindowMove();
      window.electronAPI.destroyCursorWindow();
    }

    resetExternalPreviewTargetWindow();
    hideDropIndicator();
    draggingTab = null;
    draggingTabData = null;
    draggingTabWasPinned = false;
    tabDragOriginalOrder = null;
    tabDragOriginalActiveTab = null;
    externalCancelDragging = null;
    dragIndex = -1;
    dragMouseOffsetX = 0;
    dragVisualX = null;
    isDraggingOutsideToolbar = false;
    detachedTabState = null;
    setTabDragExtendedWidth(null);

    if (isWarn || !releasedTabData || !windowBoundsCache) {
      if (releasedDetachedState) {
        releasedTabData.element.style.display = "";
        tabData = releasedOriginalOrder?.filter(Boolean) || tabData;
        syncTabDomOrderToData();
        layoutTabs({ animate: true });
        updateTabAdjacencyClasses();
      } else if (releasedTabData) {
        normalizePinnedTabs();
        if (tabOrderChangedDuringDrag) scheduleGlobalSearchAfterTabSetChange();
      }
      dragStartClientPos = null;
      windowBoundsCache = null;
      return;
    }

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const isOutsideToolbar = isOutsideTabDragContext(mouseX, mouseY);

    windowBoundsCache = null;

    if (!isOutsideToolbar) {
      if (releasedDetachedState) {
        releasedTabData.element.style.display = "";
        tabData = releasedOriginalOrder?.filter(Boolean) || tabData;
        syncTabDomOrderToData();
      }
      normalizePinnedTabs();
      layoutTabs({ animate: true });
      if (tabOrderChangedDuringDrag) scheduleGlobalSearchAfterTabSetChange();
      dragStartClientPos = null;
      return;
    }

    // get window id from cursor position
    getTabDragTargetWindowId(e.screenX, e.screenY)
      .then(async (targetWindowId) => {
        if (targetWindowId) {
          if (releasedTabData.isNotePreview) keepOpenNoteTab(releasedTabData);
          const tabInfo = await getOpenTabPayload(releasedTabData);
          window.electronAPI
            .sendTabToWindow(targetWindowId, {
              tabInfo,
              dropScreenX: e.screenX,
              dropScreenY: e.screenY,
            })
            .then(() => {
              window.electronAPI.focusWindow(targetWindowId);
            });

          finalizeDraggedTabRemovalAfterExternalDrop(releasedTabData, releasedDetachedState?.index ?? releasedOriginalOrder?.indexOf(releasedTabData) ?? 0);

          if (wasOnlyTab) {
            attemptCloseWindow();
          }
        } else if (isOutsideToolbar) {
          if (wasOnlyTab) {
            if (releasedDetachedState) {
              releasedTabData.element.style.display = "";
              tabData = releasedOriginalOrder?.filter(Boolean) || tabData;
              syncTabDomOrderToData();
              layoutTabs({ animate: true });
              updateTabAdjacencyClasses();
            }
            dragStartClientPos = null;
            return;
          }
          if (releasedTabData.isNotePreview) keepOpenNoteTab(releasedTabData);
          const position = dragStartClientPos
            ? {
                x: e.screenX - dragStartClientPos.x,
                y: e.screenY - dragStartClientPos.y,
              }
            : { x: e.screenX, y: e.screenY };
          if (releasedDetachedState) {
            const tabInfo = await getOpenTabPayload(releasedTabData);
            await window.electronAPI.createNewWindowWithTab(tabInfo, position);
            finalizeDraggedTabRemovalAfterExternalDrop(releasedTabData, releasedDetachedState.index);
          } else {
            openTabInNewWindow(releasedTabData, position);
          }
        }
      })
      .finally(() => {
        dragStartClientPos = null;
      });
  }

  // terminate dragging due to shortcut key pressing
  function handleCancelDraggingByShortcut() {
    // Prevent duplicate execution (function was already called once)
    if (!externalCancelDragging) return;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    tabPendingDeferredMouseUp = null;
    deferredOnMouseUp = false;
    deferredMouseUpEvent = null;

    if (!draggingTab) {
      tab.classList.remove("dragging-tab");
      document.body.classList.remove("tab-dragging");
      dragStartClientPos = null;
      externalCancelDragging = null;
      tabDragOriginalOrder = null;
      tabDragOriginalActiveTab = null;
      isDraggingOutsideToolbar = false;
      setTabDragExtendedWidth(null);
      return;
    }

    if (!detachedTabState) commitDraggedTabVisualBounds();
    draggingTab.classList.remove("dragging-tab");
    draggingTab.style.transition = "";
    draggingTab.style.pointerEvents = "";
    draggingTab.style.opacity = "1";
    draggingTab.style.display = "";
    if (detachedTabState) {
      restoreDetachedTabToOriginalOrder(true);
    } else if (tabDragOriginalOrder?.length) {
      tabData = tabDragOriginalOrder.filter(Boolean);
      for (const item of tabData) {
        if (item?.element) tabs.appendChild(item.element);
      }
      normalizePinnedTabs();
      layoutTabs({ animate: true });
      updateTabAdjacencyClasses();
      if (tabDragOriginalActiveTab && tabData.includes(tabDragOriginalActiveTab)) switchTab(tabDragOriginalActiveTab);
    }
    tabs.classList.remove("dragging");
    document.body.classList.remove("tab-dragging");

    if (overlayWindowVisible) {
      overlayWindowVisible = false;
      resetCursorWindowMove();
      window.electronAPI.destroyCursorWindow();
    }
    resetExternalPreviewTargetWindow();
    hideDropIndicator();
    windowBoundsCache = null;

    draggingTab = null;
    draggingTabData = null;
    draggingTabWasPinned = false;
    tabDragOriginalOrder = null;
    tabDragOriginalActiveTab = null;
    dragStartClientPos = null;
    externalCancelDragging = null;
    dragIndex = -1;
    dragMouseOffsetX = 0;
    dragVisualX = null;
    isDraggingOutsideToolbar = false;
    detachedTabState = null;
    setTabDragExtendedWidth(null);
  }
}

document.addEventListener("mouseup", (e) => {
  if (isHandlingMouseDown) {
    console.log("🚩mouseup came during mousedown; deferring onMouseUp");
    deferredOnMouseUp = true;
    deferredMouseUpEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
    };
  }
});

async function openTabInNewWindow(targetTabData, position) {
  if (!targetTabData) return;
  if (targetTabData.isPinned) return;
  const tabInfo = await getOpenTabPayload(targetTabData);
  await window.electronAPI.createNewWindowWithTab(tabInfo, position);
  removeTabAndAdjustUI(targetTabData);
}

function removeTabAndAdjustUI(targetTabData) {
  const index = tabData.indexOf(targetTabData);
  if (index === -1) return;

  clearAutosaveTimer(targetTabData);
  tabs.removeChild(targetTabData.element);
  tabData.splice(index, 1);
  layoutTabs({ animate: true });
  scheduleAllUnsavedTabAutosaves();
  scheduleGlobalSearchAfterTabSetChange();

  const isActive = targetTabData.element.classList.contains("active");

  if (!isActive) {
    updateTabAdjacencyClasses();
    return;
  }

  // Active tab was removed → switch or create
  if (tabData.length) {
    const newIndex = index === tabData.length ? Math.max(index - 1, 0) : index;
    switchTab(tabData[newIndex]);
    setTimeout(() => monacoEditor?.focus(), 0);
  } else {
    currentTab = null;
    createDefaultEmptyTab({ switchTo: false });
    switchTab(tabData[0]);
    setTimeout(() => monacoEditor?.focus(), 0);
  }
}

async function getTabDragTargetWindowId(screenX, screenY) {
  const targetWindowId = await window.electronAPI.getWindowIdAt({ x: screenX, y: screenY });
  if (!targetWindowId || targetWindowId === myWindowId) return null;
  return targetWindowId;
}

function ensureActiveTabAfterClose(preferredIndex) {
  if (!tabData.length) return;
  const active = tabData.find((tab) => tab.element.classList.contains("active"));
  if (active) {
    currentTab = active;
    updateTabAdjacencyClasses();
    return;
  }
  switchTab(tabData[Math.max(0, Math.min(preferredIndex, tabData.length - 1))]);
}

function finishClosedTabState(data, index, options = {}) {
  const { source = "non-ui", resetWidthOnEmpty = false } = options;
  if (!data || !tabData.includes(data) || data._closing) return;

  const closeByMouse = source === "mouse";
  const closingModeWidth = tabs.getBoundingClientRect().width;
  const closedTabWidth = data.element.getBoundingClientRect().width;
  const wasTrailingTab = index === tabData.length - 1;
  const wasActive = data.element.classList.contains("active");
  data._closing = true;
  if (closeByMouse) enterTabClosingMode(closingModeWidth);

  tabData = tabData.filter((tab) => tab !== data);
  addClosingTabSlot(data, index);
  if (closeByMouse && !wasTrailingTab) {
    setTabClosingModeAvailableWidth(Math.max(0, closingModeWidth - closedTabWidth));
  }
  maybeExitTabClosingModeAfterClose();

  scheduleAllUnsavedTabAutosaves();
  scheduleGlobalSearchAfterTabSetChange();
  syncRecentlyClosedFilesState();

  if (wasActive) {
    if (tabData.length) {
      const newIndex = index === tabData.length ? Math.max(index - 1, 0) : index;
      switchTab(tabData[newIndex]);
      setTimeout(() => monacoEditor?.focus(), 0);
    } else {
      currentTab = null;
      createDefaultEmptyTab({ switchTo: false });
      if (resetWidthOnEmpty) clearTabClosingModeAvailableWidth();
      switchTab(tabData[0]);
      setTimeout(() => monacoEditor?.focus(), 0);
    }
  } else {
    ensureActiveTabAfterClose(index);
    setTimeout(() => monacoEditor?.focus(), 0);
  }

  layoutTabs({ animate: true });
  scheduleClosingTabCleanup(data);
}

// create tab
function createTab(name, content = "", path = null, insertIndex = null, options = {}) {
  if (!name) name = `${i18next.t("file.untitled")}.txt`;
  const targetInsertIndex = clampUnpinnedTabInsertIndex(insertIndex);

  const tab = document.createElement("div");
  tab.className = "tab";

  const nameSpan = document.createElement("span");
  nameSpan.className = "name";
  nameSpan.textContent = name;
  nameSpan.title = name;
  const fileIcon = createFileIconElement("tab-file-icon");
  const nameWrap = document.createElement("div");
  nameWrap.className = "name-wrap";
  nameWrap.append(fileIcon, nameSpan);

  const close = document.createElement("span");
  close.className = "close";

  const unsavedDot = document.createElement("div");
  unsavedDot.className = "unsaved-dot";

  const closeSvg = document.createElement("div");
  closeSvg.className = "close-svg";
  closeSvg.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.74 8.74" width="10" height="10">
            <line x1="8.24" y1=".5" x2=".5" y2="8.24"
                  fill="none" stroke="#fff" stroke-linecap="round" stroke-miterlimit="10"/>
            <line x1="8.24" y1="8.24" x2=".5" y2=".5"
                  fill="none" stroke="#fff" stroke-linecap="round" stroke-miterlimit="10"/>
          </svg>
        `;

  close.appendChild(unsavedDot);
  close.appendChild(closeSvg);

  const tabContent = document.createElement("div");
  tabContent.className = "tab-content";
  tabContent.append(nameWrap, close);
  tab.appendChild(tabContent);

  const model = monaco.editor.createModel(content, "monapad");
  const data = {
    name,
    content,
    path,
    element: tab,
    fontSize: persistentFontSize,
    isFileSaved: true,
    model: model,
    viewState: null,
    isMarkdown: false,
    isWarned: false,
    isPinned: false,
    sourceEncoding: options.sourceEncoding || "UTF-8",
    isUtf8Valid: options.isUtf8Valid !== false,
    hasUtf8Bom: Boolean(options.hasBom),
    originalContent: content,
    _lastExternalContent: path ? content : null,
    _lastExternalHasBom: Boolean(options.hasBom),
    _lastExternalIsUtf8Valid: options.isUtf8Valid !== false,
    draftId: path ? null : createAutosaveId(),
    noteFolderPath: null,
  };

  if (targetInsertIndex !== null && targetInsertIndex >= 0 && targetInsertIndex < tabData.length) {
    const referenceTab = tabData[targetInsertIndex].element;
    tabs.insertBefore(tab, referenceTab);
    tabData.splice(targetInsertIndex, 0, data);
  } else {
    tabs.appendChild(tab);
    tabData.push(data);
  }
  syncTabDomOrderToData();
  layoutTabs({ animate: true, openingTab: data });
  updateTabHeadingIcon(data, content);

  close.onclick = async (e) => {
    e.stopPropagation();
    if (data.isPinned) {
      setTabPinned(data, false);
      return;
    }

    await attemptCloseTab(data, { source: "mouse" });

    // update tabscontainer client rect
    if (tabAreaHovered && !isMouseInsideTabsContainer()) {
      handleTabsMouseLeave();
    }
  };

  tab.onclick = (e) => {
    if (isTabControlTarget(e.target)) return;
    switchTab(data);
  };

  // tab middle click
  tab.addEventListener("auxclick", async (e) => {
    if (e.button === 1 && !data.isPinned) {
      e.preventDefault();
      e.stopPropagation();

      await attemptCloseTab(data, { source: "mouse" });

      if (tabAreaHovered && !isMouseInsideTabsContainer()) {
        handleTabsMouseLeave();
      }
    }
  });

  // tab drag handler
  enableTabDragging(tab, data);

  updateTabsCompactClass();
  scheduleGlobalSearchAfterTabSetChange();

  return data;
}

function createUntitledTab(options = {}) {
  const { insertIndex = null, switchTo = true } = options;
  const tab = createTab(null, "", null, insertIndex);
  if (switchTo) switchTab(tab);
  return tab;
}

function createPendingNoteTab(content = "", insertIndex = null, options = {}) {
  const tab = createTab(getNoteTitleFromContent(content), content, null, insertIndex);
  applyPendingNoteDataToTab(tab, content, options);
  return tab;
}

function createEmptyTabByType(type, options = {}) {
  const { insertIndex = null, switchTo = true } = options;
  const tab =
    type === "note"
      ? createPendingNoteTab("", insertIndex, { preview: false })
      : createUntitledTab({ insertIndex, switchTo: false });
  if (tab && switchTo) switchTab(tab);
  return tab;
}

function createDefaultEmptyTab(options = {}) {
  return createEmptyTabByType(getDefaultNewTabType({ invert: Boolean(options.invert) }), options);
}

function getCurrentNotesFolderPath() {
  return notesController?.getCurrentFolderPath() || "";
}

function getParentNotesFolderPath(folderPath = getCurrentNotesFolderPath()) {
  const value = String(folderPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  value.pop();
  return value.join("/");
}

async function createNoteTab(content = "", insertIndex = null, existingNote = null, options = {}) {
  const title = existingNote?.meta?.title || getNoteTitleFromContent(content);
  let note = existingNote;

  if (!note && content.trim()) {
    note = await window.electronAPI.createNote({
      content,
      title,
      folderPath: options.folderPath || getCurrentNotesFolderPath(),
    });
    if (!note?.success) {
      console.error("Failed to create note:", note?.error);
      return null;
    }
  }

  const noteContent = typeof note?.content === "string" ? note.content : content;
  const reusableTab = getReusableEmptyTab({ includeNotes: true });
  if (reusableTab) {
    await prepareReusableEmptyTabForReplacement(reusableTab);
    reusableTab._ignoreUnsavedCheck = true;
    reusableTab.model.setValue(noteContent);
    if (note) {
      applyNoteDataToTab(reusableTab, note, noteContent, options);
    } else {
      applyPendingNoteDataToTab(reusableTab, noteContent, options);
    }
    if (reusableTab === currentTab) {
      currentFilePath = `Note: ${reusableTab.name}`;
      updateStatusBar();
    }
    renderNotesList();
    return reusableTab;
  }

  if (!note) {
    const data = createPendingNoteTab(noteContent, insertIndex, options);
    renderNotesList();
    return data;
  }

  const data = createTab(title, noteContent, null, insertIndex);
  applyNoteDataToTab(data, note, noteContent, options);
  renderNotesList();
  return data;
}

async function createNewNote() {
  const data = await createNoteTab("", null, null, { preview: false });
  if (data) {
    switchTab(data);
    if (data.noteId) updateRecentNote(data.noteId);
  }
}

async function saveAsNote() {
  const active = tabData.find((t) => t.element.classList.contains("active"));
  if (!active || active.isNote || !monacoEditor) return false;

  const content = monacoEditor.getValue();
  if (!content.trim()) {
    if (!active.path && !active.isNote) {
      const previousDraftId = active.draftId;
      clearAutosaveTimer(active);
      applyPendingNoteDataToTab(active, content, { preview: false });
      if (previousDraftId) await window.electronAPI.deleteAutosaveDraft(previousDraftId);
      updateMainMenuState();
      updateStatusBar();
      await renderNotesList();
      showMessage("file-saved");
      return true;
    }

    const newTab = await createNoteTab("", null, null, { preview: false });
    if (newTab) {
      switchTab(newTab);
      showMessage("file-saved");
      return true;
    }
    return false;
  }

  const note = await window.electronAPI.createNote({
    content,
    title: getNoteTitleFromContent(content),
    folderPath: getCurrentNotesFolderPath(),
  });
  if (!note?.success) {
    console.error("Failed to save as note:", note?.error);
    return false;
  }

  if (!active.path && !active.isNote) {
    const previousDraftId = active.draftId;
    clearAutosaveTimer(active);
    active.isNote = true;
    active.noteId = note.id;
    active.notePath = note.path;
    active.noteFolderPath = note.meta?.folderPath || "";
    active.noteTitle = note.meta?.title || getNoteTitleFromContent(content);
    active.noteCreatedAt = note.meta?.createdAt || Date.now();
    active.noteUpdatedAt = note.meta?.updatedAt || Date.now();
    active.noteDirty = false;
    active.draftId = null;
    active.originalContent = content;
    active.content = content;
    active.isFileSaved = true;
    active.element.classList.add("note");
    active.element.querySelector(".close")?.classList.remove("show-unsaved");
    updateNoteTabTitle(active, content);
    if (previousDraftId) await window.electronAPI.deleteAutosaveDraft(previousDraftId);
    updateMainMenuState();
    updateStatusBar();
    await renderNotesList();
    updateRecentNote(active.noteId);
    showMessage("file-saved");
    return true;
  }

  const newTab = await createNoteTab(content, null, note);
  if (newTab) {
    switchTab(newTab);
    updateRecentNote(newTab.noteId);
    showMessage("file-saved");
    return true;
  }

  return false;
}

// close tab
async function attemptCloseTab(data, options = {}) {
  return new Promise(async (resolve) => {
    if (data?.isPinned) {
      resolve("pinned");
      return;
    }
    if (data?._closing || !tabData.includes(data)) {
      resolve("closing");
      return;
    }

    const tab = data.element;

    if (data.isNote) {
      const noteContent = data.model?.getValue() ?? data.content ?? "";
      const shouldDeleteEmptyNote = !noteContent.trim();
      if (shouldDeleteEmptyNote) {
        await deleteNoteTabStorage(data);
      } else {
        await writeNoteTab(data, noteContent, true);
      }
      const tabIndex = tabData.indexOf(data);
      if (!shouldDeleteEmptyNote) addToRecentlyClosedNote(data.noteId, data.name, tabIndex);
      clearAutosaveTimer(data);

      const index = tabData.indexOf(data);
      finishClosedTabState(data, index, { ...options, resetWidthOnEmpty: true });

      resolve("closed");
      return;
    }

    if (!data.isFileSaved) {
      const message = confirmSave.querySelector("p");

      message.textContent = i18next.t("modal.saveChanges", { name: data.name });
      confirmBox.style.display = "flex";
      confirmSave.style.display = "flex";
      isModalDisplayed = true;

      const actuallyCloseTab = async (options = {}) => {
        const tabIndex = tabData.indexOf(data);
        if (data.path) {
          addToRecentlyClosedFiles(data.path, tabIndex);
          if (options.discardUnsaved) await window.electronAPI.discardFileAutosaveBackup(data.path);
        } else if (options.discardUnsaved && data.model?.getValue()?.trim()) {
          const trash = await window.electronAPI.moveAutosaveDraftToTrash({
            draftId: data.draftId,
            name: data.name,
            ownerId: myWindowId,
            content: data.model.getValue(),
          });
          if (trash?.success) addToRecentlyClosedTrash(trash.trashId, trash.name || data.name, tabIndex);
        } else {
          await deleteTabAutosave(data);
        }
        clearAutosaveTimer(data);

        const index = tabData.indexOf(data);
        finishClosedTabState(data, index, { ...options, resetWidthOnEmpty: true });
      };

      const removeListeners = () => {
        yesBtn.removeEventListener("click", onSave);
        noBtn.removeEventListener("click", onDontSave);
        cancelBtn.removeEventListener("click", onCancel);
        window.removeEventListener("keydown", onKeyDown);
      };

      const onSave = async () => {
        confirmBox.style.display = "none";
        confirmSave.style.display = "none";
        isModalDisplayed = false;
        switchTab(data);
        let success = false;

        if (data.path) {
          success = await saveFile();
        } else {
          success = await saveAsFile();
        }

        if (success !== false) {
          await actuallyCloseTab();
          resolve("closed");
        } else {
          resolve("cancelled");
        }

        removeListeners();
      };

      const onDontSave = async () => {
        confirmBox.style.display = "none";
        confirmSave.style.display = "none";
        isModalDisplayed = false;
        await actuallyCloseTab({ discardUnsaved: true });
        removeListeners();
        resolve("closed");
      };

      const onCancel = () => {
        confirmBox.style.display = "none";
        confirmSave.style.display = "none";
        isModalDisplayed = false;
        removeListeners();
        monacoEditor?.focus();
        resolve("cancelled");
      };

      const onKeyDown = (e) => {
        if (!isModalDisplayed) return;
        const key = (e.key || "").toLowerCase();
        if (e.code === "KeyS" || key === "s") {
          e.preventDefault();
          onSave();
        } else if (e.code === "KeyD" || key === "d") {
          e.preventDefault();
          onDontSave();
        } else if (e.code === "KeyC" || e.code === "Escape" || key === "c" || key === "escape") {
          e.preventDefault();
          onCancel();
        }
      };

      yesBtn.addEventListener("click", onSave);
      noBtn.addEventListener("click", onDontSave);
      cancelBtn.addEventListener("click", onCancel);
      window.addEventListener("keydown", onKeyDown);
      return;
    }

    // close immediately when save is not required
    if (data.path) {
      const tabIndex = tabData.indexOf(data);
      addToRecentlyClosedFiles(data.path, tabIndex);
    }
    clearAutosaveTimer(data);
    if (!data.path) {
      await deleteTabAutosave(data);
    }
    const index = tabData.indexOf(data);
    finishClosedTabState(data, index, { ...options, resetWidthOnEmpty: true });

    resolve("closed");
  });
}

// add to recently closed files
function addToRecentlyClosedFiles(filePath, tabIndex) {
  if (!filePath) return;

  recentlyClosedFiles = recentlyClosedFiles.filter((item) => item.type !== "file" || item.path !== filePath);
  recentlyClosedFiles.unshift({ type: "file", path: filePath, index: tabIndex });
  if (recentlyClosedFiles.length > 10) {
    recentlyClosedFiles = recentlyClosedFiles.slice(0, 10);
  }

  updateReopenClosedTabButtonState();
}

function addToRecentlyClosedTrash(trashId, name, tabIndex) {
  if (!trashId) return;

  recentlyClosedFiles = recentlyClosedFiles.filter((item) => item.type !== "trash" || item.trashId !== trashId);
  recentlyClosedFiles.unshift({ type: "trash", trashId, name, index: tabIndex });
  if (recentlyClosedFiles.length > 10) {
    recentlyClosedFiles = recentlyClosedFiles.slice(0, 10);
  }

  updateReopenClosedTabButtonState();
}

function addToRecentlyClosedNote(noteId, name, tabIndex) {
  if (!noteId) return;

  recentlyClosedFiles = recentlyClosedFiles.filter((item) => item.type !== "note" || item.noteId !== noteId);
  recentlyClosedFiles.unshift({ type: "note", noteId, name, index: tabIndex });
  if (recentlyClosedFiles.length > 10) {
    recentlyClosedFiles = recentlyClosedFiles.slice(0, 10);
  }

  updateReopenClosedTabButtonState();
}

function updateReopenClosedTabButtonState() {
  const reopenBtn = document.querySelector('[data-action="reopenClosedTab"]');
  reopenBtn?.classList.toggle("disabled", recentlyClosedFiles.length === 0);
}

function addTabToRecentlyClosed(tab, tabIndex) {
  if (!tab) return;
  if (tab.isNote) {
    const content = tab.model?.getValue() ?? tab.content ?? "";
    if (content.trim()) addToRecentlyClosedNote(tab.noteId, tab.name, tabIndex);
    return;
  }
  if (tab.path) {
    addToRecentlyClosedFiles(tab.path, tabIndex);
  }
}

function syncRecentlyClosedFilesState() {
  const openPaths = new Set(tabData.map((tab) => tab.path).filter(Boolean));
  const openNoteIds = new Set(
    tabData
      .filter((tab) => tab.isNote)
      .map((tab) => tab.noteId)
      .filter(Boolean),
  );
  const seenPaths = new Set();
  const seenTrashIds = new Set();
  const seenNoteIds = new Set();

  recentlyClosedFiles = recentlyClosedFiles.filter((item) => {
    if (item?.type === "trash") {
      if (!item.trashId || seenTrashIds.has(item.trashId)) return false;
      seenTrashIds.add(item.trashId);
      return true;
    }

    if (item?.type === "note") {
      if (!item.noteId || openNoteIds.has(item.noteId) || seenNoteIds.has(item.noteId)) return false;
      seenNoteIds.add(item.noteId);
      return true;
    }

    const filePath = item?.path;
    if (!filePath || openPaths.has(filePath) || seenPaths.has(filePath)) return false;
    seenPaths.add(filePath);
    return true;
  });

  updateReopenClosedTabButtonState();
}

// open recently closed files
async function reopenRecentlyClosedFile() {
  syncRecentlyClosedFilesState();

  while (recentlyClosedFiles.length > 0) {
    const item = recentlyClosedFiles.shift();
    const { path: filePath, index: originalIndex } = item;

    if (item.type === "note") {
      const note = await window.electronAPI.readNote(item.noteId);
      if (!note?.exists) continue;

      const restoreIndex = Math.min(originalIndex, tabData.length);
      const restoredTab = await createNoteTab(note.content, restoreIndex, note);
      if (restoredTab) {
        switchTab(restoredTab);
        updateRecentNote(restoredTab.noteId);
        syncRecentlyClosedFilesState();
        return;
      }
      continue;
    }

    if (item.type === "trash") {
      const trash = await window.electronAPI.readAutosaveTrash(item.trashId);
      if (!trash?.exists) continue;

      let restoredTab = null;
      if (tabData.length === 1 && !tabData[0].isPinned && !tabData[0].path && !tabData[0].model?.getValue()?.trim()) {
        restoredTab = tabData[0];
        await deleteTabAutosave(restoredTab);
        restoredTab.name = trash.name;
        restoredTab.draftId = createAutosaveId();
        restoredTab.isWarned = false;
        restoredTab.isMarkdown = false;

        const nameSpan = restoredTab.element.querySelector(".name");
        if (nameSpan) {
          updateTabTitleDisplay(restoredTab);
          nameSpan.classList.remove("warn");
        }
        reloadButton(restoredTab, null, "remove");
      } else {
        const restoreIndex = Math.min(originalIndex, tabData.length);
        restoredTab = createTab(trash.name, "", null, restoreIndex);
        restoredTab.draftId = createAutosaveId();
      }

      applyRestoredAutosaveContent(restoredTab, "", trash.content);
      switchTab(restoredTab);
      scheduleTabAutosave(restoredTab, restoredTab.content);
      await window.electronAPI.deleteAutosaveTrash(item.trashId);
      syncRecentlyClosedFilesState();
      return;
    }

    const existingTab = tabData.find((tab) => tab.path === filePath);

    if (existingTab) {
      switchTab(existingTab);
      continue;
    }

    const exists = await window.electronAPI.fileExists(filePath);
    if (!exists) continue;

    const restoreIndex = Math.min(originalIndex, tabData.length);
    await loadFileByPath(filePath, restoreIndex);
    syncRecentlyClosedFilesState();
    return;
  }

  updateReopenClosedTabButtonState();
}

// close window
async function attemptCloseWindow() {
  const hasUnsavedTabs = tabData.some((tab) => !tab.isFileSaved);
  if (!hasUnsavedTabs) {
    await flushNoteTabs();
    await cleanupSavedTabAutosaves();
    window.electronAPI.closeWindow();
    return;
  }

  confirmBox.style.display = "flex";
  confirmWindow.style.display = "flex";
  isModalDisplayed = true;

  const removeListeners = () => {
    saveAllBtn.removeEventListener("click", onSaveAll);
    discardAllBtn.removeEventListener("click", onDiscardAll);
    cancelAllBtn.removeEventListener("click", onCancelAll);
    window.removeEventListener("keydown", onKeyDown);
  };

  const closeConfirm = () => {
    confirmBox.style.display = "none";
    confirmWindow.style.display = "none";
    isModalDisplayed = false;
  };

  const onSaveAll = async () => {
    closeConfirm();

    const cancelledTabs = [];

    const allTabs = [...tabData];

    for (const tab of allTabs) {
      switchTab(tab);

      if (tab.isNote) {
        const noteContent = tab.model?.getValue() ?? tab.content ?? "";
        if (noteContent.trim()) {
          await writeNoteTab(tab, noteContent, true);
        } else {
          await deleteNoteTabStorage(tab);
        }
      }

      if (!tab.isFileSaved) {
        let success = false;
        if (tab.path) {
          success = await saveFile();
        } else {
          success = await saveAsFile();
        }

        if (success === false) {
          cancelledTabs.push(tab); // keep canceled tab
          continue;
        }
      }

      if (tab.isPinned) {
        savePinnedTabsState();
        continue;
      }

      // close saved tab
      const index = tabData.indexOf(tab);
      if (index !== -1) {
        addTabToRecentlyClosed(tab, index);
        await deleteTabAutosave(tab);
        tabs.removeChild(tab.element);
        tabData.splice(index, 1);
        syncRecentlyClosedFilesState();
        layoutTabs({ animate: false });
      }
    }

    removeListeners();

    if (cancelledTabs.length === 0) {
      window.electronAPI.closeWindow();
    } else {
      switchTab(cancelledTabs[0]);
      setTimeout(() => monacoEditor?.focus(), 0);
    }
  };

  const onDiscardAll = async () => {
    closeConfirm();
    removeListeners();
    savePinnedTabsStateForDiscard();

    // close all tabs
    for (const tab of [...tabData]) {
      clearAutosaveTimer(tab);
      if (tab.isNote) {
        const noteContent = tab.model?.getValue() ?? tab.content ?? "";
        if (noteContent.trim()) {
          await writeNoteTab(tab, noteContent, true);
        } else {
          await deleteNoteTabStorage(tab);
        }
        tabs.removeChild(tab.element);
        continue;
      }
      if (!tab.isFileSaved) {
        if (tab.path) {
          await window.electronAPI.discardFileAutosaveBackup(tab.path);
        } else if (tab.model?.getValue()?.trim()) {
          await window.electronAPI.moveAutosaveDraftToTrash({
            draftId: tab.draftId,
            name: tab.name,
            ownerId: myWindowId,
            content: tab.model.getValue(),
          });
        } else {
          await deleteTabAutosave(tab);
        }
      } else {
        await deleteTabAutosave(tab);
      }
      tabs.removeChild(tab.element);
    }
    tabData = [];
    window.electronAPI.closeWindow();
  };

  const onCancelAll = () => {
    closeConfirm();
    removeListeners();
    monacoEditor?.focus();
  };

  const onKeyDown = (e) => {
    if (!isModalDisplayed) return;
    const key = (e.key || "").toLowerCase();
    if (e.code === "KeyS" || key === "s") {
      e.preventDefault();
      onSaveAll();
    } else if (e.code === "KeyD" || key === "d") {
      e.preventDefault();
      onDiscardAll();
    } else if (e.code === "KeyC" || e.code === "Escape" || key === "c" || key === "escape") {
      e.preventDefault();
      onCancelAll();
    }
  };

  saveAllBtn.addEventListener("click", onSaveAll);
  discardAllBtn.addEventListener("click", onDiscardAll);
  cancelAllBtn.addEventListener("click", onCancelAll);
  window.addEventListener("keydown", onKeyDown);
}

// switch tab
function switchTab(data) {
  if (!monacoEditor) return;

  const currentActive = tabData.find((t) => t.element.classList.contains("active"));
  if (currentActive) {
    // save tab data
    currentActive.content = currentActive.model.getValue();
    currentActive.viewState = monacoEditor.saveViewState();
    currentActive.fontSize = fontSize;
    currentActive.wordWrap = isWordWrapOn;
  }

  // load tab-specific settings
  fontSize = data.fontSize || persistentFontSize; // font size for each tabs
  isWordWrapOn = data.wordWrap ?? true;
  isMarkdownOn = data.isMarkdown ?? false;

  const editorOptions = {
    fontSize,
    wordWrap: isWordWrapOn ? "on" : "off",
    ...WRAP_MEASURE_OPTIONS,
    scrollbar: {
      horizontal: isWordWrapOn ? "hidden" : "auto",
    },
    autoClosingBrackets: isMarkdownOn ? "always" : "never",
  };

  // apply settings before model switch
  monacoEditor.updateOptions(editorOptions);
  monaco.editor.setModelLanguage(data.model, isMarkdownOn ? "markdown" : "monapad");

  // update tab style
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active", "prev-active");
  });

  const newActive = data.element;
  newActive.classList.add("active");

  updateTabAdjacencyClasses();

  // update tab content
  monacoEditor.setModel(data.model);
  attachCtrlWheelListener();

  currentTab = data;
  currentFilePath = data.isNote ? `Note: ${data.name}` : data.path || data.name;
  updateMainMenuState();
  updateDeviceShareButtonState();
  updateActiveNoteListItem();

  // restore selection, scroll position
  if (data.viewState) monacoEditor.restoreViewState(data.viewState);
  monacoEditor.focus();

  updateStatusBar();

  // re-apply tab-specific settings after model switch
  monacoEditor.updateOptions(editorOptions);
  monaco.editor.setModelLanguage(data.model, isMarkdownOn ? "markdown" : "monapad");

  // update WordWrap toggle button UI
  updateWordWrapMenuState();

  // update Markdown toggle button UI
  const mdBtn = document.querySelector('button[data-action="toggleMarkdown"] .checkmark');
  if (mdBtn) mdBtn.style.display = isMarkdownOn ? "inline-flex" : "none";

  applyDecorations();

  // stop watching previously active file
  if (currentWatchedFilePath && currentWatchedFilePath !== data.path) {
    window.electronAPI.unwatchFile(currentWatchedFilePath);
    currentWatchedFilePath = null;
  }

  // watch active file
  if (data.path && currentWatchedFilePath !== data.path) {
    window.electronAPI.watchFile(data.path);
    currentWatchedFilePath = data.path;
  }

  refreshFileTabStateOnActivate(data);
}

function updateTabAdjacencyClasses() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("prev-active");
  });

  const activeIndex = tabData.findIndex((tab) => tab.element.classList.contains("active"));
  const prev = activeIndex > 0 ? tabData[activeIndex - 1]?.element : null;
  prev?.classList.add("prev-active");
}

async function refreshFileTabStateOnActivate(tab) {
  if (!tab?.path || tab.isNote || tab._checkingDiskState) return;
  tab._checkingDiskState = true;

  try {
    tab._needsDiskRefresh = false;
    const fileInfo = await readFileWithEncodingInfo(tab.path);
    const content = fileInfo?.content;
    if (tab !== currentTab) return;

    if (content === null || content === undefined) {
      tab.isWarned = true;
      tab.element.querySelector(".name")?.classList.add("warn");
      reloadButton(tab, null, "remove");
      if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, tab);
      return;
    }

    tab.isWarned = false;
    tab.element.querySelector(".name")?.classList.remove("warn");
    if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, tab);

    if (isSameExternalFileSnapshot(tab, content, fileInfo)) {
      applyFileEncodingInfo(tab, fileInfo);
      reloadButton(tab, null, "remove");
      return;
    }

    if (isPendingSelfSaveContent(tab, content)) {
      acceptSelfSaveFileChange(tab, content, fileInfo);
      return;
    }

    if (tab.isFileSaved && normalizeTextForModelComparison(content) === tab.originalContent) {
      applyFileEncodingInfo(tab, fileInfo);
      updateExternalFileSnapshot(tab, content, fileInfo);
      reloadButton(tab, null, "remove");
      return;
    }

    if (!tabHasUnsavedContent(tab)) {
      applyFileEncodingInfo(tab, fileInfo);
      applyFileContentToEditor(tab, content, fileInfo);
      return;
    }

    if (tab.element.classList.contains("has-reload-button")) return;

    showMessage("file-modified");
    reloadButton(tab, tab.path, "add");
  } catch (error) {
    console.warn("Failed to refresh file tab state:", error);
  } finally {
    tab._checkingDiskState = false;
  }
}

// detect when file is moved, deleted, or renamed
window.electronAPI.onFileChanged((event, { filePath, eventType }) => {
  const targetTab = tabData.find((tab) => tab.path === filePath);
  if (!targetTab) return;

  if (eventType === "rename") {
    // if file is not found
    targetTab.isWarned = true;
    targetTab.element.querySelector(".name").classList.add("warn");
    reloadButton(targetTab, null, "remove");
    if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, targetTab);
  } else if (eventType === "change") {
    // if file is changed
    targetTab.isWarned = false;
    targetTab.element.querySelector(".name").classList.remove("warn");
    handleFileChange(targetTab, filePath);
    if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, targetTab);
  }
});

async function handleFileChange(targetTab, filePath) {
  let content = null;
  let fileInfo = null;
  try {
    fileInfo = await readFileWithEncodingInfo(filePath);
    content = fileInfo?.content ?? null;
  } catch (e) {
    content = null;
  }

  if (content === null) {
    // line-through name if file is not found. remove reload button
    targetTab.isWarned = true;
    targetTab.element.querySelector(".name").classList.add("warn");
    reloadButton(targetTab, null, "remove");
    if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, targetTab);
    return;
  }

  // remove line-through if file is found
  targetTab.isWarned = false;
  targetTab.element.querySelector(".name").classList.remove("warn");
  if (tabContextMenu.style.display !== "none") updateTabContextMenuState(tabContextMenu, targetTab);

  // Ignore watcher noise if the on-disk content is unchanged from the last known disk snapshot.
  if (isSameExternalFileSnapshot(targetTab, content, fileInfo)) {
    if (fileInfo) applyFileEncodingInfo(targetTab, fileInfo);
    reloadButton(targetTab, null, "remove");
    return;
  }

  if (isPendingSelfSaveContent(targetTab, content)) {
    acceptSelfSaveFileChange(targetTab, content, fileInfo);
    return;
  }

  if (targetTab.isFileSaved && normalizeTextForModelComparison(content) === targetTab.originalContent) {
    reloadButton(targetTab, null, "remove");
    if (fileInfo) applyFileEncodingInfo(targetTab, fileInfo);
    updateExternalFileSnapshot(targetTab, content, fileInfo);
    return;
  }

  if (!tabHasUnsavedContent(targetTab)) {
    if (fileInfo) applyFileEncodingInfo(targetTab, fileInfo);
    applyFileContentToEditor(targetTab, content, fileInfo);
    return;
  }

  if (targetTab.element.classList.contains("has-reload-button")) {
    if (targetTab !== currentTab) switchTab(targetTab);
    return;
  }

  // if file modified externally, add reload button and let user to decide to update or not.
  if (targetTab !== currentTab) switchTab(targetTab);
  showMessage("file-modified");
  console.log("handleFileChange: file modified externally. showing reload button");
  reloadButton(targetTab, filePath, "add");
}

function applyFileContentToEditor(tab, content, fileInfo = null) {
  if (!tab?.model || content === null || content === undefined) return false;

  if (tab !== currentTab) switchTab(tab);
  tab.viewState = monacoEditor.saveViewState();
  if (fileInfo) applyFileEncodingInfo(tab, fileInfo);
  updateExternalFileSnapshot(tab, content, fileInfo || { hasBom: tab.hasUtf8Bom, isUtf8Valid: tab.isUtf8Valid });
  tab.originalContent = content;
  tab.isFileSaved = true;

  const modelContent = replaceModelContentPreservingUndo(tab, content);
  tab.content = modelContent;
  tab.originalContent = modelContent;
  tab.isFileSaved = !hasUnsavedChanges(tab, modelContent);

  monacoEditor.restoreViewState(tab.viewState);
  monacoEditor.focus();

  const close = tab.element.querySelector(".close");
  if (close) close.classList.toggle("show-unsaved", !tab.isFileSaved);
  updatePinnedTabIcon(tab);
  if (tab.isFileSaved) {
    clearAutosaveTimer(tab);
    deleteTabAutosave(tab);
  }

  updateStatusBar();
  applyDecorations();
  showMessage("file-updated");
  reloadButton(tab, null, "remove");
  console.log("handleFileChange: content updated");
  return true;
}

function reloadButton(tab, filePath, mode) {
  const existing = tab.element.querySelector(".reload-button");

  if (mode === "remove") {
    if (existing) existing.remove();
    tab.element.classList.remove("has-reload-button");
    if (tab === currentTab) updateStatusBar();
    return;
  }

  if (mode === "add") {
    if (existing) return; // already exists

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("reload-button", "codicon", "codicon-refresh");
    tab.element.classList.add("has-reload-button");
    button.title = i18next.t("message.ReloadButtonTooltip");
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const fileInfo = await readFileWithEncodingInfo(filePath);
      const content = fileInfo?.content;
      if (content === null || content === undefined) return;
      if (tab !== currentTab) switchTab(tab);
      applyFileContentToEditor(tab, content, fileInfo);
    });

    const iconEl = tab.element.querySelector(".file-icon");
    const nameEl = tab.element.querySelector(".name");
    const referenceEl = iconEl || nameEl;
    if (referenceEl?.parentElement) referenceEl.parentElement.insertBefore(button, referenceEl);
    if (tab === currentTab) updateStatusBar();
  }
}

// open file
async function openFile() {
  const filePath = await window.electronAPI.openFileDialog();
  if (!filePath) return;
  await loadFileByPath(filePath);
}

// file load hadling
async function loadFileByPath(filePath, insertIndex = null, options = {}) {
  if (!filePath) return;
  const shouldUpdateRecent = !options.skipRecent;

  const existingTab = tabData.find((tab) => tab.path === filePath);
  if (existingTab) {
    switchTab(existingTab);
    syncRecentlyClosedFilesState();
    showMessage("file-opened");
    return;
  }

  const fileInfo = await readFileWithEncodingInfo(filePath);
  const content = fileInfo?.content;
  if (content === null || content === undefined) {
    console.error("Failed to read file.");
    return;
  }

  const fileName = filePath.split(/[/\\]/).pop();
  const autosaveBackup = await window.electronAPI.getFileAutosaveBackup(filePath);
  const shouldRestoreAutosave = autosaveBackup?.exists ? await confirmAutosaveRestore(fileName) : false;

  if (autosaveBackup?.exists && !shouldRestoreAutosave) {
    await window.electronAPI.discardFileAutosaveBackup(filePath);
  }

  const isMarkdownFile = /\.(md|markdown)$/i.test(filePath);

  if (tabData.length === 1) {
    const singleTab = tabData[0];
    if (getReusableEmptyTab({ includeNotes: true }) === singleTab) {
      await prepareReusableEmptyTabForReplacement(singleTab);
      singleTab.name = fileName;
      singleTab.path = filePath;
      applyFileEncodingInfo(singleTab, fileInfo);
      updateExternalFileSnapshot(singleTab, content, fileInfo);
      singleTab.draftId = null;
      singleTab.isFileSaved = true;
      singleTab.isMarkdown = isMarkdownFile;
      singleTab.isWarned = false;

      const nameSpan = singleTab.element.querySelector(".name");
      if (nameSpan) {
        updateTabTitleDisplay(singleTab);
        nameSpan.classList.remove("warn");
      }

      const close = singleTab.element.querySelector(".close");
      if (close) close.classList.remove("show-unsaved");

      reloadButton(singleTab, null, "remove");
      singleTab._ignoreUnsavedCheck = true;
      singleTab.model.setValue(content);
      const modelContent = singleTab.model.getValue();
      singleTab.content = modelContent;
      singleTab.originalContent = modelContent;
      singleTab.isFileSaved = true;
      if (shouldRestoreAutosave) {
        applyRestoredAutosaveContent(singleTab, modelContent, autosaveBackup.content);
        showMessage("autosave-restored");
      }
      switchTab(singleTab);
      if (shouldUpdateRecent) updateRecentFiles(filePath);
      syncRecentlyClosedFilesState();
      return;
    }
  }

  // use insertIndex if it's set, otherwise set next to active tab
  let targetIndex = insertIndex;
  if (targetIndex === null) {
    const activeIndex = tabData.findIndex((t) => t.element.classList.contains("active"));
    targetIndex = Math.min(tabData.length, activeIndex + 1);
  } else {
    targetIndex = Math.max(0, targetIndex);
  }

  const newTabData = createTab(fileName, content, filePath, targetIndex, fileInfo);
  const modelContent = newTabData.model.getValue();
  newTabData.content = modelContent;
  newTabData.originalContent = modelContent;
  updateExternalFileSnapshot(newTabData, content, fileInfo);
  newTabData.draftId = null;
  newTabData.isFileSaved = true;
  newTabData.isMarkdown = isMarkdownFile;
  newTabData.isWarned = false;
  if (shouldRestoreAutosave) {
    applyRestoredAutosaveContent(newTabData, modelContent, autosaveBackup.content);
    showMessage("autosave-restored");
  }

  const newTabClose = newTabData.element.querySelector(".close");
  if (newTabClose) newTabClose.classList.toggle("show-unsaved", shouldRestoreAutosave);
  newTabData.element.querySelector(".name")?.classList.remove("warn");
  reloadButton(newTabData, null, "remove");

  switchTab(newTabData);
  if (shouldUpdateRecent) updateRecentFiles(filePath);
  syncRecentlyClosedFilesState();
}

// recently opened file handler
function getRecentHistoryEntries() {
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem("recentFiles") || "[]");
  } catch {
    recent = [];
  }

  return recent
    .map((item) => {
      if (typeof item === "string") return { type: "file", path: item, exists: true };
      if (!item || typeof item !== "object") return null;
      if (item.type === "note" && typeof item.noteId === "string") return { type: "note", noteId: item.noteId };
      if (typeof item.path === "string") return { type: "file", path: item.path, exists: item.exists !== false };
      return null;
    })
    .filter(Boolean);
}

function storeRecentHistoryEntries(entries) {
  const seenFiles = new Set();
  const seenNotes = new Set();
  const nextEntries = [];
  let fileCount = 0;
  let noteCount = 0;

  for (const entry of entries) {
    if (entry.type === "file" && entry.path && !seenFiles.has(entry.path)) {
      seenFiles.add(entry.path);
      if (fileCount < 16) {
        nextEntries.push({ type: "file", path: entry.path, exists: entry.exists !== false });
        fileCount++;
      }
    } else if (entry.type === "note" && entry.noteId && !seenNotes.has(entry.noteId)) {
      seenNotes.add(entry.noteId);
      if (noteCount < 16) {
        nextEntries.push({ type: "note", noteId: entry.noteId });
        noteCount++;
      }
    }
  }

  localStorage.setItem("recentFiles", JSON.stringify(nextEntries.slice(0, 24)));
}

function updateRecentFiles(filePath) {
  if (!filePath) return;
  let recent = getRecentHistoryEntries();
  recent = recent.filter((item) => item.type !== "file" || item.path !== filePath);
  recent.unshift({ type: "file", path: filePath, exists: true });
  storeRecentHistoryEntries(recent);
  populateRecentMenu();
}

function updateRecentNote(noteId) {
  if (!noteId) return;
  let recent = getRecentHistoryEntries();
  recent = recent.filter((item) => item.type !== "note" || item.noteId !== noteId);
  recent.unshift({ type: "note", noteId });
  storeRecentHistoryEntries(recent);
  populateRecentMenu();
}

async function openNoteById(noteId, options = {}) {
  const preview = options.preview !== false;
  if (!noteId) return;

  const existingTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  if (existingTab) {
    const wasPreview = existingTab.isNotePreview;
    if (!preview) keepOpenNoteTab(existingTab);
    switchTab(existingTab);
    if (!preview && !wasPreview) updateRecentNote(noteId);
    return existingTab;
  }

  const pending = pendingNoteOpens.get(noteId);
  if (pending) {
    const pendingTab = await pending;
    if (pendingTab) {
      const wasPreview = pendingTab.isNotePreview;
      if (!preview) keepOpenNoteTab(pendingTab);
      switchTab(pendingTab);
      if (!preview && !wasPreview) updateRecentNote(noteId);
    }
    return pendingTab;
  }

  const previewSeq = preview ? ++notePreviewOpenSeq : null;

  const openPromise = (async () => {
    const note = await window.electronAPI.readNote(noteId);
    if (preview && previewSeq !== notePreviewOpenSeq) return null;
    if (!note?.exists) {
      await populateRecentMenu();
      return null;
    }

    let noteTab = null;

    if (preview) {
      const previewTab = tabData.find((tab) => tab.isNotePreview);
      if (previewTab) {
        moveTabToIndex(previewTab, getActiveTabInsertIndex(previewTab));
        previewTab._ignoreUnsavedCheck = true;
        previewTab.model.setValue(note.content || "");
        applyNoteDataToTab(previewTab, note, note.content || "", { preview: true });
        noteTab = previewTab;
      }
    }

    if (!noteTab) {
      const restoreIndex = getActiveTabInsertIndex();
      noteTab = await createNoteTab(note.content, restoreIndex, note, { preview });
    }

    if (preview && previewSeq !== notePreviewOpenSeq) return null;
    if (noteTab) {
      switchTab(noteTab);
      if (!preview) updateRecentNote(noteId);
    }
    return noteTab;
  })();

  pendingNoteOpens.set(noteId, openPromise);
  try {
    return await openPromise;
  } finally {
    if (pendingNoteOpens.get(noteId) === openPromise) pendingNoteOpens.delete(noteId);
  }
}

notesController = createNotesPanelController({
  i18next,
  electronAPI: window.electronAPI,
  refs: {
    notesList,
    notesListHeading,
    noteContextMenu,
  },
  getNotesIndexCache: () => notesIndexCache,
  setNotesIndexCache: (notes) => {
    notesIndexCache = notes;
  },
  getCurrentTab: () => currentTab,
  getNoteTitleFromContent,
  openNoteById,
  beginNoteListDrag,
  isNoteClickSuppressed: () => suppressNoteClick,
  populateRecentMenu,
  updateGlobalSearchActionState,
  isGlobalSearchActive,
  scheduleGlobalSearch,
  getLiveNoteContent,
  createNoteTab,
  switchTab,
  updateRecentNote,
  convertNoteToUntitled,
  convertNoteToFile,
  deleteNoteEverywhere,
  deleteFolderEverywhere,
  onNotesIndexUpdated: syncOpenNoteTabsWithNotesIndex,
  onShowContextMenu: () => {
    customContextMenu.style.display = "none";
    tabContextMenu.style.display = "none";
    rightClickedTab = null;
  },
});

async function renderNotesList(options = {}) {
  return await notesController?.renderNotesList(options);
}

function updateActiveNoteListItem() {
  notesController?.updateActiveNoteListItem();
}
globalSearchController = createGlobalSearchController({
  monaco,
  i18next,
  electronAPI: window.electronAPI,
  refs: {
    globalSearchInput,
    globalSearchPlaceholder,
    globalSearchResults,
    globalSearchResultsList,
    globalSearchCaseButton,
    globalSearchWordButton,
    globalSearchRegexButton,
    globalSearchRefreshButton,
    globalSearchClearButton,
    globalSearchCollapseButton,
  },
  getTabData: () => tabData,
  getNotesIndexCache: () => notesIndexCache,
  sortNotesForPanel,
  getNoteTitleFromContent,
  openNoteById,
  switchTab,
  revealSearchRange,
  getMonacoEditor: () => monacoEditor,
  onBeginMatchDrag: beginGlobalSearchMatchDrag,
  isMatchClickSuppressed: () => suppressGlobalSearchMatchClick,
});

function getGlobalSearchQuery() {
  return globalSearchController?.getQuery() || "";
}

function isGlobalSearchActive() {
  return Boolean(globalSearchController?.isActive());
}

function scheduleGlobalSearch() {
  globalSearchController?.schedule();
}

function scheduleGlobalSearchAfterTabSetChange() {
  globalSearchController?.scheduleAfterTabSetChange();
}

function scheduleGlobalSearchPreviewUpdate() {
  globalSearchController?.schedulePreviewUpdate();
}

function scheduleGlobalSearchFilePathUpdate() {
  globalSearchController?.scheduleFilePathUpdate();
}

function updateGlobalSearchActionState() {
  globalSearchController?.updateActionState();
}

function updateGlobalSearchLabels() {
  globalSearchController?.updateLabels();
}

function updateGlobalSearchPlaceholder(focused = document.activeElement === globalSearchInput) {
  globalSearchController?.updatePlaceholder(focused);
}

function updateGlobalSearchResultHeaderLabels() {
  globalSearchController?.updateResultHeaderLabels();
}

async function refreshGlobalSearchNow() {
  await globalSearchController?.refreshNow();
}

function syncOpenNoteTabsWithNotesIndex(notes = notesIndexCache) {
  const notesById = new Map(
    (Array.isArray(notes) ? notes : []).filter((note) => note?.id).map((note) => [note.id, note]),
  );
  let changed = false;
  for (const tab of tabData) {
    if (!tab?.isNote || !tab.noteId) continue;
    const meta = notesById.get(tab.noteId);
    if (!meta) continue;

    if (meta.createdAt && tab.noteCreatedAt !== meta.createdAt) tab.noteCreatedAt = meta.createdAt;
    if (meta.updatedAt && tab.noteUpdatedAt !== meta.updatedAt) tab.noteUpdatedAt = meta.updatedAt;
    const nextFolderPath = meta.folderPath || "";
    if (tab.noteFolderPath !== nextFolderPath) {
      tab.noteFolderPath = nextFolderPath;
      changed = true;
    }
  }
  if (changed) savePinnedTabsState();
}

let notesWindowFocusRefreshPromise = null;

async function refreshNotesOnWindowFocus() {
  if (notesWindowFocusRefreshPromise) return notesWindowFocusRefreshPromise;
  notesWindowFocusRefreshPromise = (async () => {
    const notes = await window.electronAPI.listNotes();
    notesIndexCache = sortNotesForPanel(Array.isArray(notes) ? notes : []);
    syncOpenNoteTabsWithNotesIndex(notesIndexCache);
    globalSearchController?.clearNoteContentCache();
    await renderNotesList({ scheduleSearch: false });
    await populateRecentMenu();
    updateGlobalSearchActionState();
    if (isGlobalSearchActive()) scheduleGlobalSearch();
  })();
  try {
    await notesWindowFocusRefreshPromise;
  } catch (error) {
    console.warn("Failed to refresh notes on window focus:", error);
  } finally {
    notesWindowFocusRefreshPromise = null;
  }
}

async function refreshNotesListNow() {
  globalSearchController?.clearPendingSearch();
  const dirtyNoteTabs = tabData.filter((tab) => {
    if (!tab?.isNote) return false;
    const content = tab.model?.getValue() ?? tab.content ?? "";
    if (!tab.noteId) return Boolean(content.trim());
    return !isNoteContentSaved(tab, content);
  });
  for (const tab of dirtyNoteTabs) {
    await writeNoteTab(tab, tab.model?.getValue() ?? tab.content ?? "", true);
  }
  if (window.electronAPI.refreshNotesIndex) {
    notesIndexCache = sortNotesForPanel(await window.electronAPI.refreshNotesIndex());
  }
  globalSearchController?.clearNoteContentCache();
  await renderNotesList({ scheduleSearch: false });
  updateGlobalSearchActionState();
}

function createSearchRangePayload(match) {
  if (!match?.range) return null;
  return {
    startLineNumber: match.range.startLineNumber,
    startColumn: match.range.startColumn,
    endLineNumber: match.range.endLineNumber,
    endColumn: match.range.endColumn,
  };
}

async function getOpenTabPayload(tab) {
  if (!tab) return null;
  await writeTabAutosave(tab);
  return {
    name: tab.name,
    content: tab.model?.getValue?.() ?? tab.content ?? "",
    path: tab.path,
    isNote: tab.isNote,
    noteId: tab.noteId,
    notePath: tab.notePath,
    noteFolderPath: tab.noteFolderPath,
    noteTitle: tab.noteTitle,
    noteCreatedAt: tab.noteCreatedAt,
    noteUpdatedAt: tab.noteUpdatedAt,
    isFileSaved: tab.isFileSaved,
    originalContent: tab.originalContent,
    fontSize: tab.fontSize,
    wordWrap: tab.wordWrap,
    isMarkdown: tab.isMarkdown,
    sourceEncoding: tab.sourceEncoding,
    isUtf8Valid: tab.isUtf8Valid,
    hasBom: tab.hasUtf8Bom,
    draftId: tab.draftId,
    hasReloadButton: tab.element?.classList.contains("has-reload-button"),
  };
}

async function getGlobalSearchMatchTabPayload(match) {
  let payload = null;
  if (match?.type === "note" && match.noteId) {
    payload = await getNoteTabPayload(match.noteId);
  } else if (match?.type === "tab" && match.tabId) {
    payload = await getOpenTabPayload(tabData.find((tab) => tab._searchTargetId === match.tabId));
  }
  if (!payload) return null;
  payload.searchRange = createSearchRangePayload(match);
  return payload;
}

async function openTabPayloadInCurrentWindow(payload, placement = { index: null, referenceTab: null }) {
  if (!payload) return null;
  const existingTab = getExistingTabForPayload(payload);
  if (existingTab?.isPinned) {
    const adjustedPlacement =
      placement?.index === null || placement?.index === undefined
        ? null
        : clampDropPlacementInsidePinnedTabs(placement, existingTab.element);
    if (adjustedPlacement) moveTabToDropPlacement(existingTab, adjustedPlacement);
    switchTab(existingTab);
    revealSearchRangeFromPayload(payload);
    return existingTab;
  }

  const adjustedPlacement = clampDropPlacementAfterPinnedTabs(placement, existingTab?.element || null);
  const insertIndex = adjustedPlacement.index;

  if (payload.isNote) {
    const tab = await createNoteTabFromPayload(payload, insertIndex, adjustedPlacement);
    revealSearchRangeFromPayload(payload);
    return tab;
  }

  if (existingTab) {
    moveTabToDropPlacement(existingTab, adjustedPlacement);
    switchTab(existingTab);
    revealSearchRangeFromPayload(payload);
    return existingTab;
  }

  if (getReusableEmptyTab({ includeNotes: true }) === tabData[0]) {
    const defaultTab = tabData[0];
    await prepareReusableEmptyTabForReplacement(defaultTab);
    tabs.removeChild(defaultTab.element);
    defaultTab.model?.dispose();
    tabData = [];
    layoutTabs({ animate: false });
  }

  const tab = createTab(payload.name, payload.content, payload.path, insertIndex, payload);
  tab.isFileSaved = payload.isFileSaved;
  tab.originalContent = payload.originalContent;
  tab.fontSize = payload.fontSize;
  tab.wordWrap = payload.wordWrap;
  tab.isMarkdown = payload.isMarkdown;
  tab.draftId = payload.draftId || tab.draftId;
  if (!tab.isFileSaved) {
    tab.element.querySelector(".close")?.classList.add("show-unsaved");
    await writeTabAutosave(tab, tab.model.getValue());
    scheduleTabAutosave(tab, tab.model.getValue());
  }
  if (payload.hasReloadButton) reloadButton(tab, payload.path, "add");
  switchTab(tab);
  revealSearchRangeFromPayload(payload);
  return tab;
}

async function deleteNoteEverywhere(noteId, { trash = false } = {}) {
  const result = trash ? await window.electronAPI.trashNote(noteId) : await window.electronAPI.deleteNote(noteId);
  if (!result?.success) return false;

  for (const tab of [...tabData].filter((item) => item.isNote && item.noteId === noteId)) {
    removeTabAndAdjustUI(tab);
  }
  await renderNotesList();
  await populateRecentMenu();
  return true;
}

async function deleteFolderEverywhere(folderPath) {
  const prefix = `${folderPath}/`;
  const result = await window.electronAPI.deleteFolder(folderPath);
  if (!result?.success) return false;

  for (const tab of [...tabData].filter(
    (item) => item.isNote && (item.noteFolderPath === folderPath || item.noteFolderPath?.startsWith(prefix)),
  )) {
    removeTabAndAdjustUI(tab);
  }
  await renderNotesList();
  await populateRecentMenu();
  return true;
}

async function getLiveNoteContent(noteId) {
  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  if (openTab) return openTab.model?.getValue() ?? openTab.content ?? "";
  const note = await window.electronAPI.readNote(noteId);
  return note?.exists ? note.content || "" : null;
}

async function convertNoteToUntitled(noteId) {
  const content = await getLiveNoteContent(noteId);
  if (content === null) return false;

  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  await window.electronAPI.deleteNote(noteId);

  const targetTab = openTab || createTab(null, content);
  if (openTab) {
    clearAutosaveTimer(openTab);
    openTab.isNote = false;
    openTab.isNotePreview = false;
    openTab.noteId = null;
    openTab.notePath = null;
    openTab.noteFolderPath = null;
    openTab.noteTitle = null;
    openTab.noteDirty = false;
    openTab.path = null;
    openTab.draftId = createAutosaveId();
    openTab.name = `${i18next.t("file.untitled")}.txt`;
    openTab.element.classList.remove("note", "preview");
    const nameSpan = openTab.element.querySelector(".name");
    if (nameSpan) {
      updateTabTitleDisplay(openTab);
    }
    openTab.model.setValue(content);
  }

  targetTab.content = content;
  targetTab.originalContent = "";
  targetTab.isFileSaved = false;
  targetTab.element.querySelector(".close")?.classList.add("show-unsaved");
  scheduleTabAutosave(targetTab, content);
  switchTab(targetTab);
  await renderNotesList();
  await populateRecentMenu();
  return true;
}

async function convertNoteToFile(noteId) {
  const content = await getLiveNoteContent(noteId);
  if (content === null) return false;
  const defaultName = `${getNoteTitleFromContent(content)}.txt`;
  const { filePath } = await window.electronAPI.showSaveDialog(defaultName);
  if (!filePath) return false;

  const result = await window.electronAPI.saveToFile(filePath, content, { bom: false });
  if (!result?.success) {
    console.error("Failed to convert note to file:", result?.error);
    return false;
  }

  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  await window.electronAPI.deleteNote(noteId);
  if (openTab) removeTabAndAdjustUI(openTab);
  await loadFileByPath(filePath);
  await renderNotesList();
  await populateRecentMenu();
  showMessage("file-saved");
  return true;
}

async function getNoteTabPayload(noteId) {
  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  if (openTab) {
    const content = openTab.model?.getValue() ?? openTab.content ?? "";
    return {
      name: openTab.name,
      content,
      path: null,
      isNote: true,
      noteId: openTab.noteId,
      notePath: openTab.notePath,
      noteFolderPath: openTab.noteFolderPath,
      noteTitle: truncateNoteTitle(openTab.noteTitle || openTab.name),
      noteCreatedAt: openTab.noteCreatedAt,
      noteUpdatedAt: openTab.noteUpdatedAt,
      isFileSaved: true,
      originalContent: content,
      fontSize: openTab.fontSize,
      wordWrap: openTab.wordWrap,
      isMarkdown: false,
      draftId: null,
    };
  }

  const note = await window.electronAPI.readNote(noteId);
  if (!note?.exists) return null;
  const title = truncateNoteTitle(note.meta?.title || getNoteTitleFromContent(note.content));
  return {
    name: title,
    content: note.content || "",
    path: null,
    isNote: true,
    noteId: note.id,
    notePath: note.path,
    noteFolderPath: note.meta?.folderPath || "",
    noteTitle: title,
    noteCreatedAt: note.meta?.createdAt,
    noteUpdatedAt: note.meta?.updatedAt,
    isFileSaved: true,
    originalContent: note.content || "",
    fontSize: persistentFontSize,
    wordWrap: true,
    isMarkdown: false,
    draftId: null,
  };
}

async function createNoteTabFromPayload(payload, insertIndex = null, placement = null) {
  if (!payload?.noteId)
    return createNoteTab(payload?.content || "", insertIndex, null, {
      preview: false,
    });
  const existingTab = tabData.find((tab) => tab.isNote && tab.noteId === payload.noteId);
  const pinnedCount = getPinnedTabCount();
  const adjustedPlacement =
    placement && !existingTab?.isPinned
      ? { ...placement, index: Math.max(placement.index ?? 0, pinnedCount), referenceTab: null }
      : placement;
  const adjustedInsertIndex = insertIndex === null ? null : Math.max(insertIndex, pinnedCount);
  if (existingTab) {
    if (existingTab.isNotePreview) keepOpenNoteTab(existingTab);
    moveTabToDropPlacement(existingTab, adjustedPlacement || { index: adjustedInsertIndex, referenceTab: null });
    switchTab(existingTab);
    if (existingTab.noteId) updateRecentNote(existingTab.noteId);
    return existingTab;
  }

  const note = {
    success: true,
    id: payload.noteId,
    path: payload.notePath,
    content: payload.content,
    meta: {
      folderPath: payload.noteFolderPath || "",
      title: truncateNoteTitle(payload.noteTitle || payload.name),
      createdAt: payload.noteCreatedAt,
      updatedAt: payload.noteUpdatedAt,
    },
  };
  const tab = await createNoteTab(payload.content || "", adjustedInsertIndex, note);
  if (tab) {
    switchTab(tab);
    updateRecentNote(tab.noteId);
  }
  return tab;
}

function moveTabToDropPlacement(tab, placement = null) {
  if (!tab || !placement || placement.index === null) return tab;
  const oldIndex = tabData.indexOf(tab);
  if (oldIndex === -1) return tab;

  tabData.splice(oldIndex, 1);
  if (tab.element.parentElement === tabs) tabs.removeChild(tab.element);

  const referenceTabData = placement.referenceTab
    ? tabData.find((candidate) => candidate.element === placement.referenceTab)
    : null;
  const rawIndex = referenceTabData
    ? tabData.indexOf(referenceTabData)
    : Math.max(0, Math.min(placement.index, tabData.length));
  const pinnedBoundary = tabData.filter((candidate) => candidate.isPinned).length;
  const finalIndex = tab.isPinned
    ? Math.max(0, Math.min(rawIndex, pinnedBoundary))
    : Math.max(pinnedBoundary, Math.min(rawIndex, tabData.length));

  const reference = tabData[finalIndex]?.element || null;
  tabData.splice(finalIndex, 0, tab);
  if (reference && reference !== tab.element) tabs.insertBefore(tab.element, reference);
  else tabs.appendChild(tab.element);

  normalizePinnedTabs();
  updateTabAdjacencyClasses();
  scheduleAllUnsavedTabAutosaves();
  if (oldIndex !== finalIndex) scheduleGlobalSearchAfterTabSetChange();
  return tab;
}

function getActiveTabInsertIndex(excludeTab = null) {
  const active = tabData.find((tab) => tab.element.classList.contains("active"));
  if (!active) return tabData.length;
  if (active.isPinned) return getPinnedTabCount();
  if (active === excludeTab) return tabData.indexOf(active);

  const activeIndex = tabData.indexOf(active);
  if (activeIndex === -1) return tabData.length;

  const excludedIndex = excludeTab ? tabData.indexOf(excludeTab) : -1;
  const adjustment = excludedIndex !== -1 && excludedIndex < activeIndex ? 0 : 1;
  return activeIndex + adjustment;
}

function moveTabToIndex(tab, index) {
  if (!tab || index === null || index === undefined) return tab;
  const oldIndex = tabData.indexOf(tab);
  if (oldIndex === -1) return tab;

  const targetIndex = Math.max(0, Math.min(index, tabData.length));

  tabData.splice(oldIndex, 1);
  const pinnedBoundary = tabData.filter((candidate) => candidate.isPinned).length;
  const finalIndex = tab.isPinned
    ? Math.max(0, Math.min(targetIndex, pinnedBoundary))
    : Math.max(pinnedBoundary, Math.min(targetIndex, tabData.length));
  if (oldIndex === finalIndex) {
    tabData.splice(oldIndex, 0, tab);
    syncTabDomOrderToData();
    layoutTabs({ animate: true });
    updateTabAdjacencyClasses();
    return tab;
  }
  const reference = tabData[finalIndex]?.element || null;
  tabData.splice(finalIndex, 0, tab);

  if (reference && reference !== tab.element) tabs.insertBefore(tab.element, reference);
  else tabs.appendChild(tab.element);

  normalizePinnedTabs();
  updateTabAdjacencyClasses();
  scheduleAllUnsavedTabAutosaves();
  scheduleGlobalSearchAfterTabSetChange();
  return tab;
}

function getOpenNoteTabById(noteId) {
  return tabData.find((tab) => tab.isNote && tab.noteId === noteId) || null;
}

let noteDragState = null;
let globalSearchDragState = null;
let suppressNoteClick = false;
let suppressGlobalSearchMatchClick = false;
let notePreviewOpenSeq = 0;
const pendingNoteOpens = new Map();
const NOTE_FOLDER_HOVER_ARM_DELAY = 300;
const NOTE_FOLDER_HOVER_OPEN_DELAY = 1000;
const NOTE_FOLDER_DROP_FLASH_DURATION = 280;

function beginNoteListDrag(e, item) {
  if (e.button === 1) {
    e.preventDefault();
    return;
  }
  if (e.button !== 0 || e.target.closest(".note-pin-button")) return;
  startSidePanelNoteDragFromItem(item, e);
}

function startSidePanelNoteDragFromItem(item, e, options = {}) {
  const entryType = item.dataset.entryType || "note";
  noteDragState = {
    item,
    entryType,
    entryKey: item.dataset.entryKey,
    noteId: item.dataset.noteId,
    folderPath: entryType === "folder" ? item.dataset.folderPath : getCurrentNotesFolderPath(),
    sourceFolderPath: getCurrentNotesFolderPath(),
    startY: e.clientY,
    currentY: 0,
    pointerOffsetY: e.clientY - item.getBoundingClientRect().top,
    dragIndex: [...notesList.querySelectorAll(".note-list-item")].indexOf(item),
    originalOrder: [...notesList.querySelectorAll(".note-list-item")].map((node) => node.dataset.entryKey),
    dragging: false,
    mode: "panel",
    payloadPromise: entryType === "note" ? getNoteTabPayload(item.dataset.noteId) : null,
    externalStarted: false,
    transferringToTabDrag: false,
  };
  if (options.forceDragging) {
    noteDragState.dragging = true;
    applyNoteListDragItemStyle(item);
    noteDragState.dragIndex = moveNoteListItemToCursor(item, e.clientY);
    positionNoteListItemAtCursor(noteDragState, e.clientY);
  }
}

function isPointInSidePanel(e) {
  return isPointInRect(e.clientX, e.clientY, sidePanel.getBoundingClientRect());
}

function resetNoteListDragItem(item) {
  document.body.classList.remove("note-dragging");
  if (!item) return;
  resetNoteListDragItemStyle(item);
}

function resetNoteListDragItemStyle(item) {
  if (!item) return;
  item.classList.remove("dragging");
  item.style.transition = "";
  item.style.transform = "";
  item.style.position = "";
  item.style.zIndex = "";
  item.style.pointerEvents = "";
}

function applyNoteListDragItemStyle(item) {
  document.body.classList.add("note-dragging");
  item.classList.add("dragging");
  item.style.transition = "none";
  item.style.position = "relative";
  item.style.zIndex = "2";
  item.style.pointerEvents = "none";
}

function getElementTranslateY(element) {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42 || 0;
  } catch {
    return 0;
  }
}

function getNoteListItemLayoutRect(item) {
  const rect = item.getBoundingClientRect();
  const translateY = getElementTranslateY(item);
  return {
    top: rect.top - translateY,
    bottom: rect.bottom - translateY,
    height: rect.height,
  };
}

function getNoteListItemLayoutCenter(item) {
  const rect = getNoteListItemLayoutRect(item);
  return rect.top + rect.height / 2;
}

function getNoteListShiftRects(excludeItem) {
  return new Map(
    [...notesList.querySelectorAll(".note-list-item")]
      .filter((node) => node !== excludeItem)
      .map((node) => [node, node.getBoundingClientRect().top]),
  );
}

function animateNoteListShifts(previousTops) {
  const shiftedItems = [];
  for (const [node, previousTop] of previousTops) {
    if (!node.isConnected) continue;
    const deltaY = previousTop - node.getBoundingClientRect().top;
    if (!deltaY) continue;
    if (node._noteShiftCleanup) node._noteShiftCleanup();
    node.classList.remove("note-shift-animating");
    node.classList.add("note-shift-prep");
    node.style.transform = `translateY(${deltaY}px)`;
    shiftedItems.push(node);
  }
  if (!shiftedItems.length) return;

  void notesList.offsetHeight;
  requestAnimationFrame(() => {
    for (const node of shiftedItems) {
      node.classList.remove("note-shift-prep");
      node.classList.add("note-shift-animating");
      node.style.transform = "";
      const cleanup = (event) => {
        if (event.target !== node) return;
        node.classList.remove("note-shift-animating");
        node.removeEventListener("transitionend", cleanup);
        node._noteShiftCleanup = null;
      };
      node._noteShiftCleanup = () => {
        node.classList.remove("note-shift-animating", "note-shift-prep");
        node.removeEventListener("transitionend", cleanup);
        node._noteShiftCleanup = null;
      };
      node.addEventListener("transitionend", cleanup);
    }
  });
}

function clearNoteFolderDropTarget({ flash = false } = {}) {
  if (noteDragState?.folderDropArmTimer) {
    clearTimeout(noteDragState.folderDropArmTimer);
    noteDragState.folderDropArmTimer = null;
  }
  if (noteDragState?.folderDropTimer) {
    clearTimeout(noteDragState.folderDropTimer);
    noteDragState.folderDropTimer = null;
  }
  const target = noteDragState?.folderDropElement;
  if (target) {
    target.classList.remove("folder-drop-hover");
    if (flash) {
      target.classList.remove("folder-drop-flash");
      void target.offsetWidth;
      target.classList.add("folder-drop-flash");
      setTimeout(() => target.classList.remove("folder-drop-flash"), NOTE_FOLDER_DROP_FLASH_DURATION);
    }
  }
  if (noteDragState) {
    noteDragState.folderDropKey = null;
    noteDragState.folderDropElement = null;
    noteDragState.folderDropTargetPath = null;
    noteDragState.folderDropKind = null;
    noteDragState.folderDropArmed = false;
  }
}

function getDraggedItemProjectedRect(state) {
  const item = state?.item;
  if (!item) return null;
  const rect = item.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
  };
}

function isDraggedEdgeInMiddleBand(state, targetRect) {
  const draggedRect = getDraggedItemProjectedRect(state);
  if (!draggedRect) return false;
  const middleStart = targetRect.top + targetRect.height / 3;
  const middleEnd = targetRect.top + (targetRect.height * 2) / 3;
  const edge = state.currentY >= 0 ? draggedRect.bottom : draggedRect.top;
  return edge >= middleStart && edge <= middleEnd;
}

function isDraggedEdgeInFolderDropBand(state, target, targetRect) {
  const draggedRect = getDraggedItemProjectedRect(state);
  if (!draggedRect) return false;
  if (!state.item?.classList.contains("pinned") && target.classList.contains("pinned")) {
    const upperEnd = targetRect.top + (targetRect.height * 2) / 3;
    const lowerStart = targetRect.top + targetRect.height / 3;
    const topInUpperBand = draggedRect.top >= targetRect.top && draggedRect.top <= upperEnd;
    const bottomInLowerBand = draggedRect.bottom >= lowerStart && draggedRect.bottom <= targetRect.bottom;
    return topInUpperBand || bottomInLowerBand;
  }
  return isDraggedEdgeInMiddleBand(state, targetRect);
}

function getNoteFolderDropTarget(state) {
  if (!state?.dragging) return null;
  if (state.item?.classList.contains("pinned")) return null;
  const heading = notesListHeading?.classList.contains("folder-heading") ? notesListHeading : null;
  if (heading) {
    const rect = heading.getBoundingClientRect();
    const draggedRect = getDraggedItemProjectedRect(state);
    if (draggedRect && draggedRect.bottom >= rect.top && draggedRect.top <= rect.bottom) {
      return {
        key: "parent",
        element: heading,
        targetFolderPath: getParentNotesFolderPath(),
        kind: "parent",
      };
    }
  }

  const candidates = [...notesList.querySelectorAll(".note-list-item.folder-list-item")].filter(
    (target) => target !== state.item,
  );
  for (const target of candidates) {
    const rect = getNoteListItemLayoutRect(target);
    if (!isDraggedEdgeInFolderDropBand(state, target, rect)) continue;
    return {
      key: target.dataset.entryKey,
      element: target,
      targetFolderPath: target.dataset.folderPath || "",
      kind: "folder",
    };
  }
  return null;
}

function flashNoteFolderDropElement(element) {
  if (!element) return Promise.resolve();
  element.classList.remove("folder-drop-hover");
  element.classList.remove("folder-drop-flash");
  void element.offsetWidth;
  element.classList.add("folder-drop-flash");
  return new Promise((resolve) => {
    setTimeout(() => {
      element.classList.remove("folder-drop-flash");
      resolve();
    }, NOTE_FOLDER_DROP_FLASH_DURATION);
  });
}

async function openNoteFolderDropTarget(state) {
  if (!state || noteDragState !== state || state.folderDropTargetPath == null) return;
  const targetPath = state.folderDropTargetPath;
  const targetKind = state.folderDropKind;
  const targetElement = state.folderDropElement;
  if (state.folderDropTimer) {
    clearTimeout(state.folderDropTimer);
    state.folderDropTimer = null;
  }
  state.folderDropOpening = true;
  await flashNoteFolderDropElement(targetElement);
  if (noteDragState !== state) return;
  state.folderDropKey = null;
  state.folderDropElement = null;
  state.folderDropTargetPath = null;
  state.folderDropKind = null;
  state.folderDropArmed = false;
  state.folderDropOpening = false;
  if (targetKind === "parent") await notesController?.openParentFolder?.();
  else await notesController?.openFolder?.(targetPath);
  if (noteDragState !== state) return;
  const clientY = state.lastClientY || state.startY;
  state.pendingMoveFolderPath = getCurrentNotesFolderPath();
  pickUpDraggedNoteListItemInCurrentFolder(state, clientY);
  state.originalOrder = [...notesList.querySelectorAll(".note-list-item")]
    .filter((node) => node !== state.item)
    .map((node) => node.dataset.entryKey);
  state.originalOrder.push(state.entryKey);
}

function updateNoteFolderDropTarget(e) {
  if (!noteDragState?.dragging || noteDragState.mode !== "panel") return false;
  if (noteDragState.folderDropOpening) return true;
  const target = getNoteFolderDropTarget(noteDragState);
  if (!target) {
    clearNoteFolderDropTarget();
    return false;
  }
  if (noteDragState.folderDropKey !== target.key) {
    clearNoteFolderDropTarget();
    noteDragState.folderDropKey = target.key;
    noteDragState.folderDropElement = target.element;
    noteDragState.folderDropTargetPath = target.targetFolderPath;
    noteDragState.folderDropKind = target.kind;
    noteDragState.folderDropArmed = false;
    const state = noteDragState;
    state.folderDropArmTimer = setTimeout(() => {
      if (noteDragState !== state || state.folderDropKey !== target.key) return;
      state.folderDropArmTimer = null;
      state.folderDropArmed = true;
      target.element.classList.add("folder-drop-hover");
      state.folderDropTimer = setTimeout(() => openNoteFolderDropTarget(state), NOTE_FOLDER_HOVER_OPEN_DELAY);
    }, NOTE_FOLDER_HOVER_ARM_DELAY);
  }
  return true;
}

function restoreNoteListOrder(state) {
  if (!state?.originalOrder?.length) return;
  const nodes = new Map(
    [...notesList.querySelectorAll(".note-list-item")].map((node) => [node.dataset.entryKey, node]),
  );
  for (const entryKey of state.originalOrder) {
    const node = nodes.get(entryKey);
    if (node) notesList.appendChild(node);
  }
}

function removeDraggedItemWhenVirtualFolder(state) {
  if (!state || state.pendingMoveFolderPath == null) return false;
  if (state.pendingMoveFolderPath === state.folderPath) return false;
  resetNoteListDragItemStyle(state.item);
  if (state.item?.parentNode) state.item.remove();
  return true;
}

function cleanupNoteExternalDrag() {
  document.body.classList.remove("note-external-dragging");
  hideDropIndicator();
  resetExternalPreviewTargetWindow();
  if (overlayWindowVisible) {
    overlayWindowVisible = false;
    resetCursorWindowMove();
    window.electronAPI.destroyCursorWindow();
  }
  windowBoundsCache = null;
  dragStartClientPos = null;
  externalCancelDragging = null;
}

function moveNoteListItemToCursor(item, clientY) {
  const siblings = [...notesList.querySelectorAll(".note-list-item")].filter((node) => node !== item);
  const before = siblings.find((node) => {
    return clientY < getNoteListItemLayoutCenter(node);
  });
  if (before) notesList.insertBefore(item, before);
  else notesList.appendChild(item);
  return [...notesList.querySelectorAll(".note-list-item")].indexOf(item);
}

function positionNoteListItemAtCursor(state, clientY) {
  if (!state?.item) return;
  const rect = state.item.getBoundingClientRect();
  state.currentY = clientY - (rect.top + rect.height / 2);
  state.startY = clientY - state.currentY;
  state.item.style.transform = `translateY(${state.currentY}px)`;
}

function pickUpDraggedNoteListItemInCurrentFolder(state, clientY) {
  if (!state?.entryKey) return;
  const existing = [...notesList.querySelectorAll(".note-list-item")].find(
    (node) => node.dataset.entryKey === state.entryKey,
  );
  if (existing && existing !== state.item) {
    resetNoteListDragItemStyle(state.item);
    if (state.item?.parentNode) state.item.remove();
    state.item = existing;
  } else if (!existing && state.item && !notesList.contains(state.item)) {
    notesList.appendChild(state.item);
  }

  state.item.style.transform = "";
  applyNoteListDragItemStyle(state.item);
  state.dragIndex = moveNoteListItemToCursor(state.item, clientY);
  state.item.style.transform = "";
  const baseTop = state.item.getBoundingClientRect().top;
  state.currentY = clientY - state.pointerOffsetY - baseTop;
  state.startY = clientY - state.currentY;
  state.item.style.transform = `translateY(${state.currentY}px)`;
}

async function startNoteExternalDrag(e) {
  if (!noteDragState || noteDragState.externalStarted) return;
  if (noteDragState.entryType !== "note") return;
  const state = noteDragState;
  state.externalStarted = true;
  state.mode = "external";
  if (!removeDraggedItemWhenVirtualFolder(state)) {
    restoreNoteListOrder(state);
    resetNoteListDragItem(state.item);
  } else {
    document.body.classList.remove("note-dragging");
  }
  windowBoundsCache = await window.electronAPI.getMyBounds();
  if (noteDragState !== state) return;
  dragStartClientPos = { x: e.clientX, y: e.clientY };
  externalCancelDragging = cancelNoteDragByShortcut;
  overlayWindowVisible = true;
  document.body.classList.add("note-external-dragging");
  window.electronAPI.createCursorWindow();
  updateNoteExternalDragPreview(e);
}

function isScreenPointInMyWindow(e) {
  if (!windowBoundsCache) return false;
  return (
    e.screenX >= windowBoundsCache.x &&
    e.screenX <= windowBoundsCache.x + windowBoundsCache.width &&
    e.screenY >= windowBoundsCache.y &&
    e.screenY <= windowBoundsCache.y + windowBoundsCache.height
  );
}

function updateNoteExternalDragPreview(e) {
  if (!noteDragState?.externalStarted) return;
  const existingNoteTab = getOpenNoteTabById(noteDragState.noteId);
  scheduleCursorWindowMove(e.screenX, e.screenY);
  const isPinnedExistingTab = Boolean(existingNoteTab?.isPinned);
  const canMovePinnedInThisWindow = isPinnedExistingTab && isScreenPointInMyWindow(e) && getPinnedTabCount() > 1;
  if (isPinnedExistingTab && !canMovePinnedInThisWindow) {
    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("forbidden");
    hideDropIndicator();
    return;
  }
  const shouldCheckTargetWindow = windowBoundsCache && performance.now() - lastWindowCheck > 100;
  if (shouldCheckTargetWindow) lastWindowCheck = performance.now();

  if (isScreenPointInMyWindow(e)) {
    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("move");
    showDropIndicator(e.clientX, existingNoteTab?.element || null, true, existingNoteTab || null);
    return;
  }

  if (!shouldCheckTargetWindow) return;

  window.electronAPI.getWindowIdAt({ x: e.screenX, y: e.screenY }).then(async (targetWindowId) => {
    if (!noteDragState?.externalStarted) return;
    const isInMyWindow = isScreenPointInMyWindow(e);
    let isTargetMinimized = false;
    if (targetWindowId) {
      isTargetMinimized = await window.electronAPI.isWindowMinimized(targetWindowId);
    }

    if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow && !isTargetMinimized) {
      window.electronAPI.setCursorWindowState("move");
      hideDropIndicator();
      setExternalPreviewTargetWindow(targetWindowId, e.screenX, e.screenY, {
        isNote: true,
        noteId: noteDragState.noteId,
      });
      return;
    }

    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("new");
    hideDropIndicator();
  });
}

function resumeSidePanelNoteDrag(e) {
  if (!noteDragState) return;
  const state = noteDragState;
  cleanupNoteExternalDrag();
  state.mode = "panel";
  state.externalStarted = false;
  state.transferringToTabDrag = false;
  state.dragging = true;
  pickUpDraggedNoteListItemInCurrentFolder(state, e.clientY);
}

async function finishNoteExternalDrag(e) {
  const state = noteDragState;
  if (!state) return;
  const payload = await state.payloadPromise;
  const isInMyWindow = isScreenPointInMyWindow(e);
  const position = dragStartClientPos
    ? {
        x: e.screenX - dragStartClientPos.x,
        y: e.screenY - dragStartClientPos.y,
      }
    : { x: e.screenX, y: e.screenY };

  cleanupNoteExternalDrag();
  noteDragState = null;
  if (!payload) return;

  const targetWindowId = await window.electronAPI.getWindowIdAt({ x: e.screenX, y: e.screenY });
  const existingNoteTab = getOpenNoteTabById(state.noteId);
  if (existingNoteTab?.isPinned && !isInMyWindow) return;
  if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow) {
    await window.electronAPI.sendTabToWindow(targetWindowId, {
      tabInfo: payload,
      dropScreenX: e.screenX,
      dropScreenY: e.screenY,
    });
    await window.electronAPI.focusWindow(targetWindowId);
    return;
  }

  if (isInMyWindow) {
    const placement = getTabDropPlacementByClientX(e.clientX, existingNoteTab?.element || null);
    const adjustedPlacement = existingNoteTab
      ? clampDropPlacementForTab(placement, existingNoteTab, existingNoteTab.element)
      : clampDropPlacementAfterPinnedTabs(placement, null);
    if (!adjustedPlacement) return;
    await createNoteTabFromPayload(payload, adjustedPlacement.index, adjustedPlacement);
    return;
  }

  await window.electronAPI.createNewWindowWithTab(payload, position);
}

async function cancelNoteDragByShortcut() {
  if (!noteDragState) return;
  const state = noteDragState;
  clearNoteFolderDropTarget();
  cleanupNoteExternalDrag();
  if (getCurrentNotesFolderPath() !== state.sourceFolderPath) {
    await notesController?.openFolder?.(state.sourceFolderPath || "");
  }
  if (noteDragState !== state) return;
  const existing = [...notesList.querySelectorAll(".note-list-item")].find(
    (node) => node.dataset.entryKey === state.entryKey,
  );
  if (existing && existing !== state.item) {
    resetNoteListDragItemStyle(state.item);
    if (state.item?.parentNode) state.item.remove();
    state.item = existing;
  } else if (!existing && state.item && !notesList.contains(state.item)) {
    notesList.appendChild(state.item);
  }
  restoreNoteListOrder(state);
  resetNoteListDragItem(state.item);
  noteDragState = null;
  await renderNotesList();
}

function beginGlobalSearchMatchDrag(e, row, match) {
  if (e.button === 1) {
    e.preventDefault();
    return;
  }
  if (e.button !== 0 || e.target.closest(".global-search-dismiss")) return;
  globalSearchDragState = {
    row,
    match,
    startX: e.clientX,
    startY: e.clientY,
    dragging: false,
    externalStarted: false,
    payloadPromise: getGlobalSearchMatchTabPayload(match),
  };
}

function resetGlobalSearchMatchDragRow(row) {
  if (!row) return;
  row.classList.remove("dragging");
  row.style.pointerEvents = "";
}

function applyGlobalSearchMatchDragRowStyle(row) {
  if (!row) return;
  row.classList.add("dragging");
  row.style.pointerEvents = "none";
}

async function startGlobalSearchMatchExternalDrag(e) {
  if (!globalSearchDragState || globalSearchDragState.externalStarted) return;
  const state = globalSearchDragState;
  state.externalStarted = true;
  state.dragging = true;
  applyGlobalSearchMatchDragRowStyle(state.row);
  windowBoundsCache = await window.electronAPI.getMyBounds();
  if (globalSearchDragState !== state) return;
  dragStartClientPos = { x: e.clientX, y: e.clientY };
  externalCancelDragging = cancelGlobalSearchMatchDragByShortcut;
  overlayWindowVisible = true;
  document.body.classList.add("note-external-dragging");
  window.electronAPI.createCursorWindow();
  updateGlobalSearchMatchExternalDragPreview(e);
}

async function updateGlobalSearchMatchExternalDragPreview(e) {
  const state = globalSearchDragState;
  if (!state?.externalStarted) return;
  scheduleCursorWindowMove(e.screenX, e.screenY);
  const payload = await state.payloadPromise;
  if (!payload || globalSearchDragState !== state) return;
  const existingTab = getExistingTabForPayload(payload);
  const isPinnedExistingTab = Boolean(existingTab?.isPinned);
  const canMovePinnedInThisWindow = isPinnedExistingTab && isScreenPointInMyWindow(e) && getPinnedTabCount() > 1;
  if (isPinnedExistingTab && !canMovePinnedInThisWindow) {
    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("forbidden");
    hideDropIndicator();
    return;
  }

  if (isPointInSidePanel(e)) {
    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("forbidden");
    hideDropIndicator();
    return;
  }

  const shouldCheckTargetWindow = windowBoundsCache && performance.now() - lastWindowCheck > 100;
  if (shouldCheckTargetWindow) lastWindowCheck = performance.now();

  if (isScreenPointInMyWindow(e)) {
    resetExternalPreviewTargetWindow();
    window.electronAPI.setCursorWindowState("move");
    showDropIndicator(e.clientX, existingTab?.element || null, true, existingTab || null);
    return;
  }

  if (!shouldCheckTargetWindow) return;

  const targetWindowId = await window.electronAPI.getWindowIdAt({ x: e.screenX, y: e.screenY });
  if (!globalSearchDragState?.externalStarted) return;
  const isInMyWindow = isScreenPointInMyWindow(e);
  let isTargetMinimized = false;
  if (targetWindowId) isTargetMinimized = await window.electronAPI.isWindowMinimized(targetWindowId);

  if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow && !isTargetMinimized) {
    window.electronAPI.setCursorWindowState("move");
    hideDropIndicator();
    setExternalPreviewTargetWindow(targetWindowId, e.screenX, e.screenY, payload);
    return;
  }

  resetExternalPreviewTargetWindow();
  window.electronAPI.setCursorWindowState("new");
  hideDropIndicator();
}

async function finishGlobalSearchMatchExternalDrag(e) {
  const state = globalSearchDragState;
  if (!state) return;
  const payload = await state.payloadPromise;
  const isInMyWindow = isScreenPointInMyWindow(e);
  const position = dragStartClientPos
    ? {
        x: e.screenX - dragStartClientPos.x,
        y: e.screenY - dragStartClientPos.y,
      }
    : { x: e.screenX, y: e.screenY };

  resetGlobalSearchMatchDragRow(state.row);
  cleanupNoteExternalDrag();
  globalSearchDragState = null;
  if (!payload) return;
  const existingTab = getExistingTabForPayload(payload);
  if (existingTab?.isPinned && !isInMyWindow) return;
  if (isPointInSidePanel(e)) return;

  const targetWindowId = await window.electronAPI.getWindowIdAt({ x: e.screenX, y: e.screenY });
  if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow) {
    await window.electronAPI.sendTabToWindow(targetWindowId, {
      tabInfo: payload,
      dropScreenX: e.screenX,
      dropScreenY: e.screenY,
    });
    await window.electronAPI.focusWindow(targetWindowId);
    return;
  }

  if (isInMyWindow) {
    const placement = getTabDropPlacementByClientX(e.clientX, existingTab?.element || null);
    const adjustedPlacement = existingTab
      ? clampDropPlacementForTab(placement, existingTab, existingTab.element)
      : clampDropPlacementAfterPinnedTabs(placement, null);
    if (!adjustedPlacement) return;
    await openTabPayloadInCurrentWindow(payload, adjustedPlacement);
    return;
  }

  await window.electronAPI.createNewWindowWithTab(payload, position);
}

function cancelGlobalSearchMatchDragByShortcut() {
  if (!globalSearchDragState) return;
  resetGlobalSearchMatchDragRow(globalSearchDragState.row);
  cleanupNoteExternalDrag();
  globalSearchDragState = null;
}

async function cancelActiveDragByEscape() {
  if (draggingTab && externalCancelDragging) {
    await Promise.resolve(externalCancelDragging());
    return true;
  }
  if (noteDragState) {
    await cancelNoteDragByShortcut();
    return true;
  }
  if (globalSearchDragState) {
    cancelGlobalSearchMatchDragByShortcut();
    return true;
  }
  if (externalCancelDragging) {
    await Promise.resolve(externalCancelDragging());
    return true;
  }
  return false;
}

async function moveDraggedNoteEntryToFolder(state, targetFolderPath) {
  if (!state) return false;
  const result = await window.electronAPI.moveNoteEntry({
    entryType: state.entryType,
    noteId: state.noteId,
    folderPath: state.folderPath,
    targetFolderPath,
  });
  return Boolean(result?.success);
}

window.addEventListener("mousemove", (e) => {
  if (globalSearchDragState) {
    if (!globalSearchDragState.dragging) {
      const moved =
        Math.abs(e.clientX - globalSearchDragState.startX) >= 5 ||
        Math.abs(e.clientY - globalSearchDragState.startY) >= 5;
      if (!moved) return;
      globalSearchDragState.dragging = true;
      applyGlobalSearchMatchDragRowStyle(globalSearchDragState.row);
      startGlobalSearchMatchExternalDrag(e);
      return;
    }
    if (!globalSearchDragState.externalStarted) {
      startGlobalSearchMatchExternalDrag(e);
      return;
    }
    updateGlobalSearchMatchExternalDragPreview(e);
    return;
  }

  if (!noteDragState) return;
  const { item, startY } = noteDragState;
  if (noteDragState.mode === "external") {
    if (isPointInSidePanel(e)) {
      resumeSidePanelNoteDrag(e);
      return;
    }
    updateNoteExternalDragPreview(e);
    return;
  }

  if (!noteDragState.dragging) {
    if (Math.abs(e.clientY - startY) < 5) return;
    noteDragState.dragging = true;
    noteDragState.currentY = 0;
    applyNoteListDragItemStyle(item);
  }

  if (!isPointInSidePanel(e)) {
    clearNoteFolderDropTarget();
    startNoteExternalDrag(e);
    return;
  }

  noteDragState.currentY = e.clientY - noteDragState.startY;
  noteDragState.lastClientY = e.clientY;
  item.style.transform = `translateY(${noteDragState.currentY}px)`;
  if (updateNoteFolderDropTarget(e)) {
    return;
  }

  const items = [...notesList.querySelectorAll(".note-list-item")];
  const currentRect = item.getBoundingClientRect();
  const isDraggingPinnedNote = item.classList.contains("pinned");
  for (let i = 0; i < items.length; i++) {
    const target = items[i];
    if (target === item) continue;
    if (target.classList.contains("pinned") !== isDraggingPinnedNote) continue;

    const targetCenter = getNoteListItemLayoutCenter(target);

    if (noteDragState.currentY > 0 && currentRect.bottom > targetCenter && i > noteDragState.dragIndex) {
      const oldTop = currentRect.top;
      const noteShiftRects = getNoteListShiftRects(item);
      notesList.insertBefore(item, target.nextSibling);
      animateNoteListShifts(noteShiftRects);
      const newTop = item.getBoundingClientRect().top;
      noteDragState.currentY += oldTop - newTop;
      noteDragState.startY = e.clientY - noteDragState.currentY;
      noteDragState.dragIndex = i;
      item.style.transform = `translateY(${noteDragState.currentY}px)`;
      break;
    }

    if (noteDragState.currentY < 0 && currentRect.top < targetCenter && i < noteDragState.dragIndex) {
      const oldTop = currentRect.top;
      const noteShiftRects = getNoteListShiftRects(item);
      notesList.insertBefore(item, target);
      animateNoteListShifts(noteShiftRects);
      const newTop = item.getBoundingClientRect().top;
      noteDragState.currentY += oldTop - newTop;
      noteDragState.startY = e.clientY - noteDragState.currentY;
      noteDragState.dragIndex = i;
      item.style.transform = `translateY(${noteDragState.currentY}px)`;
      break;
    }
  }
});

window.addEventListener("mouseup", async (e) => {
  if (globalSearchDragState) {
    const { row, dragging } = globalSearchDragState;
    if (dragging) {
      suppressGlobalSearchMatchClick = true;
      setTimeout(() => {
        suppressGlobalSearchMatchClick = false;
      }, 0);
      await finishGlobalSearchMatchExternalDrag(e);
      return;
    }
    resetGlobalSearchMatchDragRow(row);
    globalSearchDragState = null;
    return;
  }

  if (!noteDragState) return;
  const state = noteDragState;
  const { item, dragging } = state;
  if (noteDragState.mode === "external") {
    await finishNoteExternalDrag(e);
    return;
  }
  const dropFolderPath = state.folderDropArmed ? state.folderDropTargetPath : null;
  const pendingMoveFolderPath = state.pendingMoveFolderPath;
  clearNoteFolderDropTarget();
  noteDragState = null;
  document.body.classList.remove("note-dragging");
  if (!dragging) return;
  suppressNoteClick = true;
  setTimeout(() => {
    suppressNoteClick = false;
  }, 0);
  const targetFolderPath = dropFolderPath ?? pendingMoveFolderPath ?? null;
  const movingToDifferentFolder = targetFolderPath !== null && targetFolderPath !== state.folderPath;
  if (movingToDifferentFolder && item?.parentNode) {
    item.remove();
    resetNoteListDragItemStyle(item);
  } else {
    resetNoteListDragItemStyle(item);
  }
  if (targetFolderPath !== null && targetFolderPath !== state.folderPath) {
    await moveDraggedNoteEntryToFolder(state, targetFolderPath);
  }
  const orderedKeys = [...notesList.querySelectorAll(".note-list-item")]
    .map((node) => node.dataset.entryKey)
    .filter(Boolean);
  await window.electronAPI.reorderNotes({ folderPath: getCurrentNotesFolderPath(), orderedKeys });
  await renderNotesList();
  await populateRecentMenu();
});

// update open recent menu
async function populateRecentMenu() {
  let recent = getRecentHistoryEntries();
  const notes = await window.electronAPI.listNotes();
  const notesById = new Map(
    (Array.isArray(notes) ? notes : []).filter((note) => note?.id).map((note) => [note.id, note]),
  );

  const nextRecent = [];
  let existingFileCount = 0;
  let missingFileCount = 0;

  for (const entry of recent) {
    if (entry.type === "file") {
      let exists = false;
      try {
        exists = await window.electronAPI.fileExists(entry.path);
      } catch {
        exists = false;
      }

      if (exists) {
        if (existingFileCount < 16) {
          nextRecent.push({ type: "file", path: entry.path, exists: true });
          existingFileCount++;
        }
      } else if (missingFileCount < 8) {
        nextRecent.push({ type: "file", path: entry.path, exists: false });
        missingFileCount++;
      }
    } else if (entry.type === "note" && notesById.has(entry.noteId)) {
      nextRecent.push({ type: "note", noteId: entry.noteId });
    }
    if (nextRecent.length >= 24) break;
  }

  storeRecentHistoryEntries(nextRecent);

  const displayEntries = nextRecent.filter((entry) => entry.type === "note" || entry.exists).slice(0, 16);

  recentMenu.innerHTML = "";

  // disable button when no recently opened files
  if (displayEntries.length === 0) {
    openRecentBtn.classList.add("disabled");
    recentMenu.style.display = "none";
    return 0;
  }
  openRecentBtn.classList.remove("disabled");

  displayEntries.forEach((entry) => {
    const button = document.createElement("button");
    const span = document.createElement("span");

    if (entry.type === "note") {
      const note = notesById.get(entry.noteId);
      const title = truncateNoteTitle(note?.title || getDefaultNoteTitle());
      button.className = "recent-note-button";
      span.textContent = title;
      button.title = title;
      button.addEventListener("click", async () => {
        recentMenu.style.display = "none";
        await openNoteById(entry.noteId, { preview: false });
      });
    } else {
      const path = entry.path;
      button.className = "recent-file-button";
      span.textContent = path;
      button.title = path;
      button.addEventListener("click", async () => {
        recentMenu.style.display = "none";
        console.log("Opening file:", path, typeof path);
        if (typeof path === "string") {
          await loadFileByPath(path);
        } else {
          console.warn("Invalid path value:", path);
        }
      });
    }

    button.appendChild(span);
    recentMenu.appendChild(button);
  });

  // clear buttons
  const hr = document.createElement("div");
  hr.className = "hr";
  recentMenu.appendChild(hr);

  const clearButton = document.createElement("button");
  clearButton.innerHTML = `<span>${i18next.t("menu.clearHistory")}</span>`;
  clearButton.className = "clear-recent-btn";
  clearButton.addEventListener("click", () => {
    localStorage.removeItem("recentFiles");
    populateRecentMenu();
  });
  recentMenu.appendChild(clearButton);
  return displayEntries.length;
}
populateRecentMenu();
renderNotesList();

// save as
async function saveAsFile() {
  const active = tabData.find((t) => t.element.classList.contains("active"));
  if (!active || !monacoEditor) return;

  const content = monacoEditor.getValue();
  if (active.isNote) {
    const defaultName = `${getNoteTitleFromContent(content)}.txt`;
    const { filePath } = await window.electronAPI.showSaveDialog(defaultName);
    if (!filePath) return false;

    const result = await window.electronAPI.saveToFile(filePath, content, { bom: false });
    if (result.success) {
      await writeNoteTab(active, content, true);
      updateRecentFiles(filePath);
      showMessage("file-saved");
      return true;
    }

    console.error("Failed to save note as file:", result.error);
    return false;
  }

  const previousDraftId = active.draftId;
  clearAutosaveTimer(active);
  const { filePath } = await window.electronAPI.showSaveDialog(active.name);
  if (!filePath) {
    scheduleTabAutosave(active, content);
    return false;
  }

  const result = await window.electronAPI.saveToFile(filePath, content, { bom: false });
  if (result.success) {
    active.path = filePath;
    active.name = filePath.split(/[\\/]/).pop();
    updateTabTitleDisplay(active);
    active.originalContent = content;
    active.isFileSaved = true;
    active.draftId = null;
    const fileInfo = await refreshTabEncodingInfoFromDisk(active);
    updateExternalFileSnapshot(active, content, fileInfo);
    clearAutosaveTimer(active);
    if (previousDraftId) await window.electronAPI.deleteAutosaveDraft(previousDraftId);
    await window.electronAPI.discardFileAutosaveBackup(filePath);
    active._autosaveStatus = "none";
    active._autosaveBackedUpContent = null;

    currentFilePath = filePath;
    updateStatusBar();

    const activeClose = active.element.querySelector(".close");
    if (activeClose) activeClose.classList.remove("show-unsaved");
    updatePinnedTabIcon(active);
    reloadButton(active, null, "remove");
    updateRecentFiles(filePath);
    savePinnedTabsState();
    showMessage("file-saved");
    switchTab(active);
    return true;
  } else {
    console.error("Failed to save file:", result.error);
    return false;
  }
}

// overwrite save
async function saveFile() {
  const active = tabData.find((t) => t.element.classList.contains("active"));
  console.log("Saving file path:", active?.path);
  if (!active || !monacoEditor) return false;

  if (active.isNote) {
    const success = await writeNoteTab(active, monacoEditor.getValue(), true);
    if (success) showMessage("file-saved");
    return success;
  }

  // excute saveAsFile when no path
  if (!active.path) {
    return await saveAsFile();
  }

  if (active.isFileSaved && !active.isWarned) {
    console.log("No changes to save.");
    return true;
  }

  const content = monacoEditor.getValue();
  markPendingSelfSave(active, content);
  const result = await window.electronAPI.saveToFile(active.path, content, getFileSaveOptions(active));
  if (result.success) {
    console.log("File saved successfully");

    // udpate unsaved indicator when saved
    active.originalContent = content;
    active.isFileSaved = true;
    const fileInfo = await refreshTabEncodingInfoFromDisk(active);
    updateExternalFileSnapshot(active, content, fileInfo);
    clearAutosaveTimer(active);
    await window.electronAPI.discardFileAutosaveBackup(active.path);
    active._autosaveStatus = "none";
    active._autosaveBackedUpContent = null;

    const activeSaveClose = active.element.querySelector(".close");
    if (activeSaveClose) activeSaveClose.classList.remove("show-unsaved");
    updatePinnedTabIcon(active);
    reloadButton(active, null, "remove");
    savePinnedTabsState();
    showMessage("file-saved");
  } else {
    clearPendingSelfSave(active);
    console.error("Failed to save file:", result.error);
    if (result.error.includes("EPERM")) {
      return await saveAsFile();
    }
  }
}

function hasUnsavedChanges(tab, content = null) {
  const nextContent = content ?? tab?.content ?? tab?.model?.getValue() ?? "";
  const savedContent = tab?.originalContent ?? "";
  return nextContent !== savedContent;
}

function syncTabSaveState(tab, content = null) {
  if (!tab) return false;
  updateTabHeadingIcon(tab, content);

  if (tab.isNote) {
    const nextContent = content ?? tab?.content ?? tab?.model?.getValue() ?? "";
    tab.isFileSaved = true;
    tab.noteDirty = !isNoteContentSaved(tab, nextContent);
    updateNoteTabTitle(tab, nextContent);
    const close = tab.element?.querySelector(".close");
    if (close) close.classList.remove("show-unsaved");
    savePinnedTabsState();
    return tab.noteDirty;
  }

  const hasChanges = hasUnsavedChanges(tab, content);
  tab.isFileSaved = !hasChanges;
  if (!hasChanges) {
    deleteTabAutosave(tab);
  }

  const close = tab.element?.querySelector(".close");
  if (close) {
    close.classList.toggle("show-unsaved", hasChanges);
  }
  updatePinnedTabIcon(tab);
  savePinnedTabsState();

  return hasChanges;
}

// file saved & file already opened message
const messageQueue = [];
let isShowingMessage = false;
let isWindowFocused = true; // default is focused
let notesFocusRefreshTimer = null;

function scheduleNotesFocusRefresh(delay = 150) {
  if (notesFocusRefreshTimer) clearTimeout(notesFocusRefreshTimer);
  notesFocusRefreshTimer = setTimeout(() => {
    notesFocusRefreshTimer = null;
    if (!isWindowFocused) return;
    if (noteDragState || globalSearchDragState) {
      scheduleNotesFocusRefresh(150);
      return;
    }
    refreshNotesOnWindowFocus();
  }, delay);
}

function isStatusBarVisible() {
  return Boolean(settings.statusBarVisible);
}

function showTransientStatusMessage(id) {
  if (!statusLeft || !statusMessageEl) return false;
  if (transientStatusMessageId === id) return true;
  transientStatusMessageId = id;
  statusMessageEl.textContent = i18next.t(
    id === "autosave-restored"
      ? "message.autosaveRestored"
      : id === "file-updated"
        ? "message.fileUpdated"
        : "message.saved",
  );
  statusLeft.classList.add("show-message");
  if (transientStatusMessageTimer) clearTimeout(transientStatusMessageTimer);
  transientStatusMessageTimer = setTimeout(() => {
    transientStatusMessageId = null;
    transientStatusMessageTimer = null;
    statusLeft.classList.remove("show-message");
  }, 1800);
  return true;
}

function shakeTabTitle(tab = currentTab) {
  const nameEl = tab?.element?.querySelector(".name");
  if (!nameEl) return;
  nameEl.classList.remove("shake");
  void nameEl.offsetWidth;
  nameEl.classList.add("shake");
  nameEl.addEventListener("animationend", () => nameEl.classList.remove("shake"), { once: true });
}

function showMessage(id) {
  if (id === "file-opened") {
    shakeTabTitle(currentTab);
    return;
  }
  if (isStatusBarVisible()) {
    if (id === "file-saved") {
      updateStatusBar();
      return;
    }
    if (id === "autosave-restored" || id === "file-updated") {
      showTransientStatusMessage(id);
      return;
    }
    if (id === "file-modified") {
      updateStatusBar();
      return;
    }
  }

  const currentShowing = document.querySelector(".show");
  if (messageQueue.includes(id) || (currentShowing && currentShowing.id === id)) {
    return;
  }

  messageQueue.push(id);
  if (!isShowingMessage && isWindowFocused) {
    processQueue();
  }
}

function processQueue() {
  if (messageQueue.length === 0) {
    isShowingMessage = false;
    return;
  }
  if (!isWindowFocused) {
    isShowingMessage = false; // stop process when not focused
    return;
  }
  isShowingMessage = true;
  const id = messageQueue.shift();
  const el = document.getElementById(id);
  if (!el) {
    processQueue(); // go next when no element
    return;
  }
  el.classList.add("show");
  const duration = 1500;
  setTimeout(() => {
    el.classList.remove("show");
    processQueue();
  }, duration);
}

// get forcus state
window.electronAPI.onWindowFocus((focused) => {
  isWindowFocused = focused;
  if (notesFocusRefreshTimer) {
    clearTimeout(notesFocusRefreshTimer);
    notesFocusRefreshTimer = null;
  }
  if (focused) scheduleNotesFocusRefresh();
  if (focused && messageQueue.length > 0 && !isShowingMessage) {
    processQueue();
  }
});

// Tab context menu handler
document.addEventListener("contextmenu", async (e) => {
  const tabElement = e.target.closest(".tab");
  if (!tabElement) return;

  e.preventDefault();
  rightClickedTab = tabData.find((t) => t.element === tabElement);
  if (!rightClickedTab) return;

  syncRecentlyClosedFilesState();

  // update reopen closed tab button
  const validItems = [];
  for (const item of recentlyClosedFiles) {
    if (item?.type === "trash") {
      const trash = await window.electronAPI.readAutosaveTrash(item.trashId);
      if (trash?.exists) validItems.push(item);
      continue;
    }

    if (item?.type === "note") {
      const exists = await window.electronAPI.noteExists(item.noteId);
      if (exists) validItems.push(item);
      continue;
    }

    if (item?.path) {
      const exists = await window.electronAPI.fileExists(item.path);
      if (exists) validItems.push(item);
    }
  }
  if (validItems.length !== recentlyClosedFiles.length) {
    recentlyClosedFiles = validItems;
    updateReopenClosedTabButtonState();
  }

  // Hide editor context menu
  customContextMenu.style.display = "none";
  notesController?.closeContextMenu();

  // Update copy & open path button
  updateTabContextMenuState(tabContextMenu, rightClickedTab);

  // menu position
  tabContextMenu.style.display = "block";
  tabContextMenu.style.visibility = "hidden";

  const menuWidth = tabContextMenu.offsetWidth;
  const menuHeight = tabContextMenu.offsetHeight;
  const pageWidth = window.innerWidth;
  const pageHeight = window.innerHeight;

  let left = e.pageX;
  let top = e.pageY;

  if (left + menuWidth > pageWidth) {
    left = Math.max(0, pageWidth - menuWidth);
  }
  if (top + menuHeight > pageHeight) {
    top = Math.max(0, pageHeight - menuHeight);
  }

  tabContextMenu.style.left = `${left}px`;
  tabContextMenu.style.top = `${top}px`;
  tabContextMenu.style.visibility = "visible";
  tabContextMenu.style.display = "flex";
});

// update copy & open path button based on path existance
function updateTabContextMenuState(menu, tab) {
  if (!menu) return;
  const copyPathBtn = menu.querySelector('[data-action="copyPath"]');
  const openPathBtn = menu.querySelector('[data-action="openPath"]');
  const openInNewWindowBtn = menu.querySelector('[data-action="openInNewWindow"]');
  const keepOpenBtn = menu.querySelector('[data-action="keepOpen"]');
  const togglePinBtn = menu.querySelector('[data-action="togglePin"]');

  const hasPath = tab && tab.path;
  const isWarn = Boolean(tab?.isWarned);

  if (copyPathBtn) copyPathBtn.classList.toggle("disabled", !hasPath || isWarn);
  if (openPathBtn) openPathBtn.classList.toggle("disabled", !hasPath || isWarn);
  if (openInNewWindowBtn)
    openInNewWindowBtn.classList.toggle("disabled", isWarn || tab?.isPinned || tabData.length === 1);
  if (keepOpenBtn) keepOpenBtn.classList.toggle("disabled", !tab?.isNotePreview);
  if (togglePinBtn)
    togglePinBtn.querySelector(".label").textContent = i18next.t(tab?.isPinned ? "tabMenu.unpin" : "tabMenu.pin");
}

// Close multiple tabs one by one (close others, close to the right & close saved)
async function closeTabsSequentially(tabsToClose) {
  if (tabsToClose.length === 0) return;

  for (const tabToClose of tabsToClose) {
    // Check if tab still exists (might have been closed already)
    if (tabData.includes(tabToClose)) {
      if (tabToClose.isPinned) continue;
      const closed = await attemptCloseTab(tabToClose);
      // If user cancelled, stop the process
      if (closed === "cancelled") {
        break;
      }
    }
  }
}

// Tab context menu click handler
tabContextMenu.addEventListener("click", async (e) => {
  const action = e.target.closest("button")?.dataset.action;
  if (!action || !rightClickedTab) return;

  const targetTab = rightClickedTab;

  tabContextMenu.style.display = "none";
  rightClickedTab = null;

  switch (action) {
    case "close":
      await attemptCloseTab(targetTab);
      break;

    case "closeOthers":
      const otherTabs = tabData.filter((t) => t !== targetTab && !t.isPinned);
      if (otherTabs.length > 0) {
        await closeTabsSequentially(otherTabs);
      }
      break;

    case "closeToRight":
      const rightClickedIndex = tabData.indexOf(targetTab);
      const tabsToRight = tabData.slice(rightClickedIndex + 1).filter((tab) => !tab.isPinned);
      if (tabsToRight.length > 0) {
        await closeTabsSequentially(tabsToRight);
      }
      break;

    case "closeSaved":
      const savedTabs = tabData.filter((t) => t.isFileSaved && !t.isPinned);
      if (savedTabs.length > 0) {
        await closeTabsSequentially(savedTabs);
      }
      break;

    case "copyPath":
      if (targetTab && targetTab.path) {
        try {
          await navigator.clipboard.writeText(targetTab.path);
        } catch (err) {
          console.error("Failed to copy path:", err);
        }
      }
      break;

    case "openPath":
      if (targetTab && targetTab.path) {
        try {
          await window.electronAPI.openPath(targetTab.path);
        } catch (err) {
          console.error("Failed to open path:", err);
        }
      }
      break;

    case "reopenClosedTab":
      await reopenRecentlyClosedFile();
      break;

    case "openInNewWindow":
      if (!targetTab.isPinned) await openTabInNewWindow(targetTab);
      break;

    case "keepOpen":
      keepOpenNoteTab(targetTab);
      break;

    case "togglePin":
      toggleTabPinned(targetTab);
      break;
  }
});

function updateWordWrapMenuState() {
  const wrapBtn = document.querySelector('button[data-action="wordWrap"] .checkmark');
  if (wrapBtn) wrapBtn.style.display = isWordWrapOn ? "inline-flex" : "none";
}

function toggleWordWrap() {
  isWordWrapOn = !isWordWrapOn;
  if (currentTab) currentTab.wordWrap = isWordWrapOn;
  monacoEditor.updateOptions({
    wordWrap: isWordWrapOn ? "on" : "off",
    ...WRAP_MEASURE_OPTIONS,
    scrollbar: {
      horizontal: isWordWrapOn ? "hidden" : "auto",
    },
  });
  updateWordWrapMenuState();
}

// editor context menu display & position handler
editor.addEventListener("contextmenu", (e) => {
  e.preventDefault();

  tabContextMenu.style.display = "none";
  rightClickedTab = null;
  notesController?.closeContextMenu();

  customContextMenu.style.display = "block";
  customContextMenu.style.visibility = "hidden";

  const menuWidth = customContextMenu.offsetWidth;
  const menuHeight = customContextMenu.offsetHeight;
  const pageWidth = window.innerWidth;
  const pageHeight = window.innerHeight;

  let left = e.pageX;
  let top = e.pageY;

  // X
  if (left + menuWidth > pageWidth) {
    left = Math.max(0, pageWidth - menuWidth);
  }

  // Y
  if (top + menuHeight > pageHeight) {
    top = Math.max(35, pageHeight - menuHeight);
  } else {
    top = Math.max(35, top);
  }

  customContextMenu.style.left = `${left}px`;
  customContextMenu.style.top = `${top}px`;
  customContextMenu.style.visibility = "visible";
  customContextMenu.style.display = "flex";
});

// editor context menu click handler
customContextMenu.addEventListener("click", async (e) => {
  const actionElement = e.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }
  const action = actionElement.dataset.action;
  if (!action) {
    return;
  }

  const model = monacoEditor.getModel();

  switch (action) {
    case "copy": {
      try {
        const selections = monacoEditor.getSelections();
        const model = monacoEditor.getModel();
        let textToCopy = "";

        if (selections && selections.length > 0) {
          textToCopy = selections.map((sel) => model.getValueInRange(sel)).join("\n");
        }

        await navigator.clipboard.writeText(textToCopy);
      } catch (err) {
        console.error("Copy failed:", err);
      }
      break;
    }

    case "cut": {
      try {
        const selections = monacoEditor.getSelections();
        const model = monacoEditor.getModel();
        let textToCut = "";

        if (selections && selections.length > 0) {
          textToCut = selections.map((sel) => model.getValueInRange(sel)).join("\n");
          await navigator.clipboard.writeText(textToCut);
          monacoEditor.executeEdits(
            "cut",
            selections.map((sel) => ({
              range: sel,
              text: "",
              forceMoveMarkers: true,
            })),
          );
        }
      } catch (err) {
        console.error("Cut failed:", err);
      }
      break;
    }

    case "paste":
      try {
        const text = await navigator.clipboard.readText();
        monacoEditor.trigger("keyboard", "type", { text });
      } catch (err) {
        console.error("Paste failed:", err);
      }
      break;

    case "undo":
      monacoEditor.trigger("keyboard", "undo", null);
      break;

    case "redo":
      monacoEditor.trigger("keyboard", "redo", null);
      break;

    case "selectAll":
      monacoEditor.trigger("keyboard", "editor.action.selectAll", null);
      break;

    case "wordWrap":
      toggleWordWrap();
      break;

    case "toggleMarkdown":
      const currentLang = monaco.editor.getModel(monacoEditor.getModel().uri).getLanguageId();
      isMarkdownOn = currentLang !== "markdown";
      if (currentTab) currentTab.isMarkdown = isMarkdownOn;
      monaco.editor.setModelLanguage(model, isMarkdownOn ? "markdown" : "monapad");
      monacoEditor.updateOptions({ autoClosingBrackets: isMarkdownOn ? "always" : "never" });
      applyDecorations();
      {
        const btn = e.target.closest('button[data-action="toggleMarkdown"]');
        if (btn) {
          const svg = btn.querySelector(".checkmark");
          if (svg) svg.style.display = isMarkdownOn ? "inline-flex" : "none";
        }
      }
      break;
  }

  setTimeout(() => {
    customContextMenu.style.display = "none";
  }, 0);
});

// keep focus on editor when context menu is opened
customContextMenu.addEventListener("mousedown", (e) => {
  e.preventDefault();
});

// settings menu display
function isSettingsMenuOpen() {
  return settingsMenu.style.display === "block";
}

function closeSettingsMenu() {
  const wasOpen = isSettingsMenuOpen();
  settingsMenu.style.display = "none";
  langDropdown.hideDropdown();
  fontDropdown.hideDropdown();
  if (wasOpen) monacoEditor?.focus();
}

function openSettingsMenu() {
  closeContextMenus({ focus: false });
  settingsMenu.style.display = "block";
  menu.style.display = "none";
  themeMenu.style.display = "none";
  recentMenu.style.display = "none";
  setMenuButtonsPointerEvents("auto");
}

function toggleSettingsMenu() {
  if (isSettingsMenuOpen()) closeSettingsMenu();
  else openSettingsMenu();
}

function isElementOpen(element) {
  return element?.style.display && element.style.display !== "none";
}

function closeContextMenus({ focus = true } = {}) {
  let closed = false;

  if (isElementOpen(customContextMenu)) {
    customContextMenu.style.display = "none";
    closed = true;
  }

  if (isElementOpen(tabContextMenu)) {
    tabContextMenu.style.display = "none";
    rightClickedTab = null;
    closed = true;
  }

  if (isElementOpen(noteContextMenu)) {
    notesController?.closeContextMenu();
    closed = true;
  }

  if (closed && focus) monacoEditor?.focus();
  return closed;
}

function closeAppMenus() {
  if (!isElementOpen(menu) && !isElementOpen(themeMenu) && !isElementOpen(recentMenu)) return false;

  menu.style.display = "none";
  themeMenu.style.display = "none";
  recentMenu.style.display = "none";
  setMenuButtonsPointerEvents("auto");
  monacoEditor?.focus();
  return true;
}

async function closeTopOverlayByEscape() {
  if (isElementOpen(confirmSave) || isElementOpen(confirmWindow) || isElementOpen(autosaveRestore)) {
    return false;
  }

  if (deviceShareController?.isOpen()) {
    await deviceShareController.closeModal();
    return true;
  }

  if (isElementOpen(about)) {
    closeAboutModal();
    return true;
  }

  if (isModalDisplayed) return false;

  if (closeContextMenus()) return true;
  if (closeAppMenus()) return true;

  if (isSettingsMenuOpen()) {
    closeSettingsMenu();
    return true;
  }

  if (notesController?.isEditingFolderName()) return false;

  if (document.body.classList.contains("side-panel-open")) {
    setSidePanelOpen(false);
    return true;
  }

  return false;
}

settingsButton.addEventListener("click", (e) => {
  e.stopPropagation();
  openSettingsMenu();
});
editor.addEventListener("click", () => {
  closeSettingsMenu();
});
settingsMenu.addEventListener("click", (e) => {
  langDropdown.hideDropdown();
  fontDropdown.hideDropdown();
  // e.stopPropagation();
});
// prevent focus() from auto scrolling dropdown into view
settingsMenu.addEventListener("focusin", () => {
  if (scrollLocked) return;
  scrollLocked = true;
  lastScrollTop = settingsMenu.scrollTop;

  requestAnimationFrame(() => {
    settingsMenu.scrollTop = lastScrollTop;
  });

  setTimeout(() => {
    settingsMenu.scrollTop = lastScrollTop;
    scrollLocked = false;

    scrollAdjustQueue.forEach((fn) => fn());
    scrollAdjustQueue = [];
  }, 10);
});

// shortcuts
window.addEventListener(
  "keydown",
  (e) => {
    if (e.code !== "Escape" || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!draggingTab && !noteDragState && !globalSearchDragState && !externalCancelDragging) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void cancelActiveDragByEscape();
  },
  true,
);

window.addEventListener("keydown", async (e) => {
  if (e.code === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (await cancelActiveDragByEscape()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (await closeTopOverlayByEscape()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  // Ctrl + Alt + S
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyS") {
    e.preventDefault();
    await saveAsNote();
    return;
  }
  // Ctrl + S (+ Shift)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === "KeyS") {
    e.preventDefault();
    if (e.shiftKey) {
      saveAsFile();
    } else {
      saveFile();
    }
  }
  // Ctrl + B
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === "KeyB") {
    e.preventDefault();
    toggleSidePanel();
  }
  // Ctrl + O
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyO") {
    e.preventDefault();
    openFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "Comma") {
    e.preventDefault();
    toggleSettingsMenu();
  }
  // Ctrl + Alt + T
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyT") {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    createDefaultEmptyTab({ invert: true });
  }
  // Ctrl + Shift + T
  else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyT") {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    await reopenRecentlyClosedFile();
  }
  // Ctrl + T
  else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === "KeyT") {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    createDefaultEmptyTab();
  }
  // Ctrl + N
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyN") {
    e.preventDefault();
    window.electronAPI.createNewWindow();
  }
  // Ctrl + W
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyW") {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    const data = currentTab;
    if (!data) return;
    if (data.isPinned) {
      const currentIndex = tabData.indexOf(data);
      const nextTab = tabData[(currentIndex + 1) % tabData.length];
      if (nextTab) switchTab(nextTab);
      return;
    }
    await attemptCloseTab(data);
  }

  // Ctrl + 1-9
  if ((e.ctrlKey || e.metaKey) && /^Digit[1-9]$/.test(e.code)) {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    const index = parseInt(e.code.slice(-1), 10) - 1;
    if (tabData[index] && tabData[index] !== currentTab) {
      switchTab(tabData[index]);
    }
  }

  // Ctrl + Tab (+ Shift)
  if ((e.ctrlKey || e.metaKey) && e.code === "Tab") {
    if (externalCancelDragging) externalCancelDragging();
    e.preventDefault();
    if (!currentTab) return;

    const currentIndex = tabData.indexOf(currentTab);
    let nextIndex;

    if (e.shiftKey) {
      nextIndex = (currentIndex - 1 + tabData.length) % tabData.length;
    } else {
      nextIndex = (currentIndex + 1) % tabData.length;
    }

    switchTab(tabData[nextIndex]);
  }
});
