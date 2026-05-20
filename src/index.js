import * as monaco from "monaco-editor";
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js";
import { INotificationService } from "monaco-editor/esm/vs/platform/notification/common/notification.js";
import { IQuickInputService } from "monaco-editor/esm/vs/platform/quickinput/common/quickInput.js";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css";
import { CustomSelect } from "./custom-select.js";
import i18next from "i18next";
import QRCode from "qrcode";

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
const notesBadgeToggleButton = document.getElementById("notes-badge-toggle");
const notesBadgeFilterBar = document.getElementById("notes-badge-filter-bar");
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

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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
const deviceShareBtn = document.getElementById("device-share-btn");
const deviceShareTitle = document.getElementById("device-share-title");
const deviceShareModal = document.getElementById("device-share-modal");
const deviceShareClose = document.getElementById("device-share-close");
const deviceShareQr = document.getElementById("device-share-qr");
const deviceShareQrWrap = document.getElementById("device-share-qr-wrap");
const deviceShareUrlRow = document.getElementById("device-share-url-row");
const deviceShareUrl = document.getElementById("device-share-url");
const deviceShareCopy = document.getElementById("device-share-copy");
const deviceShareRegenerate = document.getElementById("device-share-regenerate");
const deviceShareDescription = document.getElementById("device-share-description");
const deviceShareError = document.getElementById("device-share-error");
let activeDeviceShareUrl = null;
let deviceShareExpiresAt = null;
let deviceShareCountdownTimer = null;
let deviceShareStatusSyncing = false;
let deviceShareCopyResetTimer = null;

// tab dragging
let lastPreviewX = null;
let lastPreviewY = null;
let draggingTab = null;
let draggingTabData = null;
let draggingTabWasPinned = false;
let dragStartX = 0;
let originalX = 0;
let startX = 0;
let currentX = 0;
let dragIndex = -1;
let wasOnlyTab = false;
let overlayWindowVisible = false;
let windowBoundsCache = null;
let dragStartClientPos = null;
let cachedToolbarRect = null;
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
const DEFAULT_THEME_NAMES = ["dark", "onyx", "ash"];
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
const DEVICE_SHARE_DIRECT_URL_MAX_BYTES = 1500;
const autosaveTimers = new Map();
let isRestoringAutosaveDrafts = false;
let transientStatusMessageId = null;
let transientStatusMessageTimer = null;
let saveStatusFadeTimer = null;

// tabs hover state, width handling
let tabAreaHovered = false;
let fixedTabsWidth = null;
let pendingTabsWidthAfterClose = null;
let isHoveringLastTab = false;
let mouseX = 0;
let mouseY = 0;

// editor context menu
let isWordWrapOn = true;
let isMarkdownOn = false;

// modal display state
let isModalDisplayed = false;
let dragCounter = 0;

// store right clicked tab
let rightClickedTab = null;
let rightClickedNoteId = null;
let notesIndexCache = [];
const NOTE_BADGE_STORAGE_KEY = "monapadNoteBadgesVisible";
const NOTE_BADGE_FILTER_STORAGE_KEY = "monapadNoteBadgeFilter";
const NOTE_BADGE_EDGES = [
  { key: "top", bit: 1 },
  { key: "right", bit: 2 },
  { key: "bottom", bit: 4 },
  { key: "left", bit: 8 },
];
const NOTE_BADGE_ALL_FILTER = "all";
let areNoteBadgesVisible = localStorage.getItem(NOTE_BADGE_STORAGE_KEY) !== "false";
let noteBadgeFilter = localStorage.getItem(NOTE_BADGE_FILTER_STORAGE_KEY) || NOTE_BADGE_ALL_FILTER;
const GLOBAL_SEARCH_DEBOUNCE_MS = 120;
const GLOBAL_SEARCH_MAX_MATCHES = 10000;
const GLOBAL_SEARCH_WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
const GLOBAL_SEARCH_PREVIEW_MAX = 1000;
const GLOBAL_SEARCH_HOVER_MAX = 100;
const GLOBAL_SEARCH_BEFORE_MAX_RATIO = 0.7;
const GLOBAL_SEARCH_MATCH_MIN_RATIO = 0.3;
const GLOBAL_SEARCH_HISTORY_LIMIT = 100;
const GLOBAL_SEARCH_INPUT_MIN_HEIGHT = 26;
const GLOBAL_SEARCH_INPUT_MAX_HEIGHT = 118;
const GLOBAL_SEARCH_IDLE_PREVIEW_BATCH = 16;
let globalSearchTimer = null;
let globalSearchSeq = 0;
let globalSearchPreviewFrame = null;
let globalSearchPreviewIdleHandle = null;
let globalSearchFilePathFrame = null;
let globalSearchMeasureContext = null;
let globalSearchPreviewObserver = null;
let globalSearchVisiblePreviewRows = new Set();
let globalSearchIdlePreviewRows = new Set();
let globalSearchHistory = [];
let globalSearchHistoryIndex = -1;
let globalSearchHistoryDraft = "";
let openTabSearchIdSeq = 0;
let globalSearchResultsSignature = "";
const globalSearchPreviewDisplayCache = new Map();
let globalSearchState = {
  query: "",
  matchCase: false,
  wholeWord: false,
  regex: false,
  results: [],
  totalMatches: 0,
  totalItems: 0,
  limitHit: false,
  allCollapsed: false,
  collapsedTargetIds: new Set(),
  dismissedMatches: new Set(),
};
const noteContentCache = new Map();

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

function getTabDropPlacementByClientX(clientX, excludeTab = null) {
  const tabElements = Array.from(tabs.querySelectorAll(".tab")).filter((tab) => tab !== excludeTab);
  const tabsRect = tabs.getBoundingClientRect();
  if (!tabElements.length) return { index: 0, left: 0, referenceTab: null };

  const rects = tabElements.map((tab) => tab.getBoundingClientRect());
  const firstRect = rects[0];
  const lastRect = rects[rects.length - 1];

  if (clientX < firstRect.left) {
    return { index: 0, left: Math.max(0, firstRect.left - tabsRect.left), referenceTab: tabElements[0] };
  }
  if (clientX > lastRect.right) {
    return { index: tabElements.length, left: Math.max(0, lastRect.right - tabsRect.left), referenceTab: null };
  }

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (clientX >= rect.left && clientX <= rect.right) {
      if (clientX <= rect.left + rect.width / 2) {
        return { index: i, left: Math.max(0, rect.left - tabsRect.left), referenceTab: tabElements[i] };
      }
      return { index: i + 1, left: Math.max(0, rect.right - tabsRect.left), referenceTab: tabElements[i + 1] || null };
    }
    const nextRect = rects[i + 1];
    if (nextRect && clientX < nextRect.left) {
      return { index: i + 1, left: Math.max(0, rect.right - tabsRect.left), referenceTab: tabElements[i + 1] };
    }
  }

  return { index: tabElements.length, left: Math.max(0, tabsRect.width), referenceTab: null };
}

function clampDropPlacementAfterPinnedTabs(placement, excludeTab = null) {
  const pinnedCount = getPinnedTabCount();
  if (!placement || placement.index === null || placement.index >= pinnedCount) return placement;

  const tabElements = Array.from(tabs.querySelectorAll(".tab")).filter((tab) => tab !== excludeTab);
  const referenceTab = tabElements[pinnedCount] || null;
  const tabsRect = tabs.getBoundingClientRect();
  const left = referenceTab
    ? Math.max(0, referenceTab.getBoundingClientRect().left - tabsRect.left)
    : Math.max(0, tabsRect.width);

  return { index: pinnedCount, left, referenceTab };
}

function clampDropPlacementInsidePinnedTabs(placement, excludeTab = null) {
  const pinnedCount = getPinnedTabCount();
  if (!placement || placement.index === null || pinnedCount <= 0) return null;

  const tabElements = Array.from(tabs.querySelectorAll(".tab")).filter((tab) => tab !== excludeTab);
  const excludedTabData = excludeTab ? tabData.find((tab) => tab.element === excludeTab) : null;
  const effectivePinnedCount = pinnedCount - (excludedTabData?.isPinned ? 1 : 0);
  if (effectivePinnedCount <= 0) return null;
  if (placement.index <= effectivePinnedCount) return placement;

  const referenceTab = tabElements[effectivePinnedCount] || null;
  const lastPinnedTab = tabElements[effectivePinnedCount - 1] || null;
  const tabsRect = tabs.getBoundingClientRect();
  const left = lastPinnedTab
    ? Math.max(0, lastPinnedTab.getBoundingClientRect().right - tabsRect.left)
    : Math.max(0, tabsRect.width);

  return { index: pinnedCount, left, referenceTab };
}

function clampDropPlacementForTab(placement, tab, excludeTab = null) {
  return tab?.isPinned
    ? clampDropPlacementInsidePinnedTabs(placement, excludeTab)
    : clampDropPlacementAfterPinnedTabs(placement, excludeTab);
}

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
    newTabData.noteTitle = payload.noteTitle || payload.name;
    newTabData.noteCreatedAt = payload.noteCreatedAt;
    newTabData.noteUpdatedAt = payload.noteUpdatedAt;
    newTabData.noteBadgeMask = normalizeNoteBadgeMask(payload.noteBadgeMask);
    newTabData.noteDirty = false;
    newTabData.draftId = null;
    newTabData.path = null;
    newTabData.isFileSaved = true;
    newTabData.originalContent = payload.content;
    newTabData.element.classList.add("note");
    newTabData.element.querySelector(".close")?.classList.remove("show-unsaved");
    updateNoteTabTitle(newTabData, payload.content);
    updateTabNoteBadge(newTabData);
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
const monacoNlsRestartWarning = document.getElementById("monacoNlsRestartWarning");
langSwitcher.value = savedLang;

function getUiLanguageTag(lang = "en") {
  return (
    {
      en: "en-US",
      ja: "ja-JP",
      zh: "zh-CN",
      de: "de-DE",
    }[lang] || lang
  );
}

function applyUiLanguage(lang) {
  document.documentElement.lang = getUiLanguageTag(lang);
}

function updateMonacoNlsRestartWarning(lang) {
  if (!monacoNlsRestartWarning) return;
  monacoNlsRestartWarning.hidden = lang === initialMonacoNlsLang;
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
    },
  })
  .then(() => {
    applyUiLanguage(i18next.language);
    updateMenuLabels();
    registerMonacoFormattingActions();
    registerMonacoQuickInputActions();
  });

function updateMenuLabels() {
  // menu
  document.querySelector("#newTabBtn .label").textContent = i18next.t("menu.new");
  document.querySelector("#newNoteBtn .label").textContent = i18next.t("menu.newNote");
  document.querySelector("#newWindowBtn .label").textContent = i18next.t("menu.newWindow");
  document.querySelector("#openFileBtn .label").textContent = i18next.t("menu.open");
  document.querySelector("#openRecent .btn-text").textContent = i18next.t("menu.openRecent");
  document.querySelector("#saveFileBtn .label").textContent = i18next.t("menu.save");
  document.querySelector("#saveAsFileBtn .label").textContent = i18next.t("menu.saveAs");
  document.querySelector("#saveAsNoteBtn .label").textContent = i18next.t("menu.saveAsNote");
  document.querySelector("#triggerFindBtn .label").textContent = i18next.t("menu.find");
  document.querySelector("#triggerReplaceBtn .label").textContent = i18next.t("menu.replace");
  document.querySelector("#triggerGoToLineBtn .label").textContent = i18next.t("menu.goToLine");
  document.querySelector("#triggerGoToSymbolBtn .label").textContent = i18next.t("menu.goToSymbol");
  document.querySelector("#triggerQuickOpenBtn .label").textContent = i18next.t("menu.quickOpen");
  document.querySelector("#triggerShowCommandsBtn .label").textContent = i18next.t("menu.showCommands");
  // document.getElementById("print-button").textContent = i18next.t("menu.print");
  document.querySelector("#changeTheme .btn-text").textContent = i18next.t("menu.theme");
  document.querySelector("#settingsBtn .label").textContent = i18next.t("menu.settings");
  document.querySelector("#toggleSidePanelBtn .label").textContent = i18next.t("menu.sidePanel");
  document.getElementById("aboutBtn").textContent = i18next.t("menu.about");
  document.getElementById("aboutBtn").textContent = i18next.t("menu.about");
  document.getElementById("aboutBtn").textContent = i18next.t("menu.about");
  document.querySelector('button[data-theme="onyx"] span').textContent = i18next.t("menu.onyx");
  document.querySelector('button[data-theme="dark"] span').textContent = i18next.t("menu.dark");
  document.querySelector('button[data-theme="ash"] span').textContent = i18next.t("menu.ash");
  updateMainMenuState();

  // message
  document.getElementById("file-saved").textContent = i18next.t("message.saved");
  document.getElementById("file-opened").textContent = i18next.t("message.fileAlreadyOpened");
  document.getElementById("file-updated").textContent = i18next.t("message.fileUpdated");
  document.getElementById("file-modified").textContent = i18next.t("message.fileModified");
  document.getElementById("autosave-restored").textContent = i18next.t("message.autosaveRestored");

  // device share modal
  if (deviceShareBtn) deviceShareBtn.title = i18next.t("deviceShare.tooltip");
  if (deviceShareTitle) deviceShareTitle.textContent = i18next.t("deviceShare.title");
  if (deviceShareCopy) deviceShareCopy.textContent = i18next.t("deviceShare.copyLink");
  if (deviceShareClose) deviceShareClose.textContent = i18next.t("deviceShare.close");
  if (deviceShareDescription) deviceShareDescription.textContent = i18next.t("deviceShare.description");
  updateDeviceShareRegenerateButton();

  // editor context menu
  document.querySelector('button[data-action="cut"] .label').textContent = i18next.t("editorMenu.cut");
  document.querySelector('button[data-action="copy"] .label').textContent = i18next.t("editorMenu.copy");
  document.querySelector('button[data-action="paste"] .label').textContent = i18next.t("editorMenu.paste");
  document.querySelector('button[data-action="undo"] .label').textContent = i18next.t("editorMenu.undo");
  document.querySelector('button[data-action="redo"] .label').textContent = i18next.t("editorMenu.redo");
  document.querySelector('button[data-action="selectAll"] .label').textContent = i18next.t("editorMenu.selectAll");
  document.querySelector('button[data-action="wordWrap"] span').textContent = i18next.t("editorMenu.wordWrap");
  document.querySelector('button[data-action="toggleMarkdown"] span').textContent =
    i18next.t("editorMenu.markdownMode");

  // tab context menu
  document.querySelector('button[data-action="close"] .label').textContent = i18next.t("tabMenu.close");
  document.querySelector('button[data-action="closeOthers"] .label').textContent = i18next.t("tabMenu.closeOthers");
  document.querySelector('button[data-action="closeToRight"] .label').textContent = i18next.t("tabMenu.closeToRight");
  document.querySelector('button[data-action="closeSaved"] .label').textContent = i18next.t("tabMenu.closeSaved");
  document.querySelector('button[data-action="copyPath"] .label').textContent = i18next.t("tabMenu.copyPath");
  document.querySelector('button[data-action="openPath"] .label').textContent = i18next.t("tabMenu.openPath");
  document.querySelector('button[data-action="reopenClosedTab"] .label').textContent =
    i18next.t("tabMenu.reopenClosedTab");
  document.querySelector('button[data-action="openInNewWindow"] .label').textContent =
    i18next.t("tabMenu.openInNewWindow");
  document.querySelector('button[data-action="keepOpen"] .label').textContent = i18next.t("tabMenu.keepOpen");
  updateTabContextMenuState(tabContextMenu, rightClickedTab);

  // side panel
  const globalSearch = document.getElementById("global-search");
  if (globalSearch) updateGlobalSearchPlaceholder(document.activeElement === globalSearchInput);
  updateGlobalSearchLabels();
  updateGlobalSearchResultHeaderLabels();
  if (notesListHeading) notesListHeading.textContent = i18next.t("sidePanel.notesSection");
  if (globalSearchHeading) {
    const label = i18next.t("sidePanel.searchSection");
    globalSearchHeading.textContent = label;
    globalSearchHeading.title = `${label} (Ctrl+Shift+F)`;
  }
  if (notesAddButton) {
    const newNoteLabel = i18next.t("sidePanel.newNote");
    notesAddButton.setAttribute("aria-label", newNoteLabel);
    notesAddButton.title = newNoteLabel;
  }
  if (notesListRefreshButton) {
    const refreshLabel = i18next.t("sidePanel.refresh");
    notesListRefreshButton.setAttribute("aria-label", refreshLabel);
    notesListRefreshButton.title = refreshLabel;
  }
  updateNoteBadgeToggleButton();
  updateNoteBadgeContextMenuLabels();
  if (sidePanelClose) sidePanelClose.setAttribute("aria-label", i18next.t("sidePanel.closePanel"));
  document.querySelector('#note-context-menu button[data-action="copyText"]').textContent =
    i18next.t("sidePanel.copyText");
  document.querySelector('#note-context-menu button[data-action="duplicate"]').textContent =
    i18next.t("sidePanel.duplicate");
  document.querySelector('#note-context-menu button[data-action="convertToUntitled"]').textContent =
    i18next.t("sidePanel.convertToUntitled");
  document.querySelector('#note-context-menu button[data-action="convertToFile"]').textContent =
    i18next.t("sidePanel.convertToFile");
  document.querySelector('#note-context-menu button[data-action="delete"]').textContent = i18next.t("sidePanel.delete");

  // settings
  document.querySelector("#settings-menu .font .h1").textContent = i18next.t("settings.font");
  document.querySelector("#settings-menu .size").textContent = i18next.t("settings.size");
  document.querySelector("#settingsLayout .h1").textContent = i18next.t("settings.layout");
  document.querySelector("#toggleStatusBar span").textContent = i18next.t("settings.statusBar");
  document.querySelector("#toggleKuromoji span").textContent = i18next.t("settings.kuromoji");
  document.querySelector("#toggleKuromoji").title = i18next.t("settings.kuromojiTooltip");
  document.querySelector("#default-new-tab-note span").textContent = i18next.t("settings.defaultNewTabNote");
  document.querySelector("#line-highlight span").textContent = i18next.t("settings.highlightLine");
  document.querySelector("#line-num span").textContent = i18next.t("settings.lineNumbers");
  document.querySelector("#minimap span").textContent = i18next.t("settings.displayMinimap");
  document.querySelector("#toggleSyntaxHighlight span").textContent = i18next.t("settings.syntaxHighlight");
  document.querySelector("#toggleFolding span").textContent = i18next.t("settings.folding");
  document.querySelector("#settings-menu .tabSize").textContent = i18next.t("settings.tabSize");
  document.getElementById("settingsLanguage").textContent = i18next.t("settings.language");
  document.getElementById("langDescription").innerHTML = i18next.t("settings.langDescription");
  if (monacoNlsRestartWarning) {
    monacoNlsRestartWarning.textContent = i18next.t("settings.monacoRestartWarning");
  }
  document.getElementById("settingsCustomTheme").textContent = i18next.t("settings.customTheme");
  document.getElementById("openThemeFolder").textContent = i18next.t("settings.openThemeFolder");
  document.getElementById("customThemeDescription").innerHTML = i18next.t("settings.customThemeDescription");
  document.querySelector(".font .reset").title = i18next.t("settings.resetTooltip");
  document.querySelector("#settingsLayout .reset").title = i18next.t("settings.resetTooltip");
  updateSettingsTooltips();
  updateNewTabShortcutLabels();

  // modal
  document.querySelector("#file-drop p").textContent = i18next.t("modal.fileDrop");
  document.getElementById("confirm-save-yes").innerHTML = i18next.t("modal.confirmSave");
  document.getElementById("confirm-save-no").innerHTML = i18next.t("modal.dontSave");
  document.getElementById("confirm-save-cancel").innerHTML = i18next.t("modal.cancel");
  document.querySelector("#confirm-save-window p").textContent = i18next.t("modal.confirmSaveWindow");
  document.getElementById("confirm-save-all").innerHTML = i18next.t("modal.saveAll");
  document.getElementById("confirm-discard-all").innerHTML = i18next.t("modal.discardAll");
  document.getElementById("confirm-cancel-all").innerHTML = i18next.t("modal.cancel");
  if (autosaveRestoreMessage) autosaveRestoreMessage.textContent = i18next.t("autosave.restoreMessage");
  if (autosaveRestoreYes) autosaveRestoreYes.textContent = i18next.t("autosave.restore");
  if (autosaveRestoreNo) autosaveRestoreNo.textContent = i18next.t("autosave.discard");
  // document.getElementById("description").textContent = i18next.t("modal.description");
  document.getElementById("discordServer").textContent = i18next.t("modal.discordServer");
  document.getElementById("website").textContent = i18next.t("modal.website");
  document.getElementById("creator").textContent = i18next.t("modal.creator");
  document.getElementById("disclaimer-title").textContent = i18next.t("modal.disclaimer");
}

function setTitle(selector, title) {
  const el = document.querySelector(selector);
  if (el) el.title = title || "";
}

function removeTitle(selector) {
  const el = document.querySelector(selector);
  if (el) el.removeAttribute("title");
}

function updateSettingsTooltips() {
  removeTitle("#settingsLayout .h1");
  setTitle("#default-new-tab-note", i18next.t("settings.defaultNewTabNote"));
  setTitle("#line-highlight", i18next.t("settings.highlightLine"));
  setTitle("#line-num", i18next.t("settings.lineNumbers"));
  setTitle("#toggleFolding", i18next.t("settings.folding"));
  setTitle("#minimap", i18next.t("settings.displayMinimap"));
  setTitle("#toggleSyntaxHighlight", i18next.t("settings.syntaxHighlight"));
  setTitle("#toggleStatusBar", i18next.t("settings.statusBar"));
  setTitle("#toggleKuromoji", i18next.t("settings.kuromoji"));
  setTitle("#settings-menu .tabSize", i18next.t("settings.tabSize"));
  removeTitle("#settings-menu .font .h1");
  setTitle(".font-select-row .custom-select__trigger", selectedFontFamily);
  setTitle(".font-select-row .custom-select__input", selectedFontFamily);
  setTitle("#settings-menu .size", i18next.t("settings.size"));
  removeTitle("#settingsCustomTheme");
  setTitle("#openThemeFolder", i18next.t("settings.openThemeFolder"));
  removeTitle("#settingsLanguage");
}

function updateNoteBadgeContextMenuLabels() {
  ensureNoteBadgeContextButtons();
  const badgeButtonLabel = noteContextMenu?.querySelector(".note-context-badge-row .label");
  if (badgeButtonLabel) badgeButtonLabel.textContent = i18next.t("sidePanel.noteMark");
  NOTE_BADGE_EDGES.forEach((edge) => {
    const button = noteContextMenu?.querySelector(`.note-badge-edge-button[data-edge="${edge.key}"]`);
    if (!button) return;
    const label = i18next.t(`sidePanel.noteMark${edge.key[0].toUpperCase()}${edge.key.slice(1)}`);
    button.title = label;
    button.setAttribute("aria-label", label);
  });
}

function updateNoteBadgeToggleButton() {
  if (notesBadgeFilterBar) notesBadgeFilterBar.setAttribute("aria-label", i18next.t("sidePanel.noteMark"));
  if (!notesBadgeToggleButton) return;
  const label = i18next.t(areNoteBadgesVisible ? "sidePanel.hideNoteMarks" : "sidePanel.showNoteMarks");
  notesBadgeToggleButton.setAttribute("aria-label", label);
  notesBadgeToggleButton.title = label;
  notesBadgeToggleButton.classList.toggle("active", areNoteBadgesVisible);
  document.body.classList.toggle("note-badges-visible", areNoteBadgesVisible);
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

let monacoFormattingActionDisposables = [];

function disposeMonacoActions(disposables) {
  disposables.forEach((disposable) => disposable?.dispose?.());
  disposables.length = 0;
}

// subtext / tab / heading shortcuts
function registerMonacoFormattingActions() {
  disposeMonacoActions(monacoFormattingActionDisposables);

  monacoFormattingActionDisposables.push(
    monacoEditor.addAction({
      id: "toggle-subtext",
      label: i18next.t("monaco.actions.toggleSubtext"),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      precondition: null,
      keybindingContext: null,
      run: function (ed) {
        const model = ed.getModel();
        const selections = ed.getSelections();

        ed.pushUndoStop();
        ed.executeEdits(
          "toggle-subtext",
          selections
            .map((selection) => {
              const startLine = selection.startLineNumber;
              const endLine = selection.endLineNumber;
              const edits = [];

              for (let line = startLine; line <= endLine; line++) {
                const lineContent = model.getLineContent(line);
                if (/^\s*-# /.test(lineContent)) {
                  // remove subtext
                  const newText = lineContent.replace(/^(\s*)-# /, "$1");
                  edits.push({
                    range: new monaco.Range(line, 1, line, lineContent.length + 1),
                    text: newText,
                  });
                } else {
                  // add subtext
                  edits.push({
                    range: new monaco.Range(line, 1, line, lineContent.length + 1),
                    text: `-# ${lineContent}`,
                  });
                }
              }

              return edits;
            })
            .flat(),
        );
        ed.pushUndoStop();
      },
    }),
  );

  monacoFormattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.keepOpenNotePreview",
      label: i18next.t("monaco.actions.keepOpen"),
      keybindings: [monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyCode.Enter)],
      precondition: null,
      keybindingContext: null,
      run: function () {
        keepOpenNoteTab(currentTab);
      },
    }),
  );

  monacoFormattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.toggleTabPin",
      label: i18next.t("monaco.actions.toggleTabPin"),
      keybindings: [
        monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.Shift | monaco.KeyCode.Enter),
      ],
      precondition: null,
      keybindingContext: null,
      run: function () {
        toggleTabPinned(currentTab);
      },
    }),
  );

  [1, 2, 3].forEach((level) => {
    monacoFormattingActionDisposables.push(monacoEditor.addAction(createToggleHeadingAction(level)));
  });
}

// heading shortcut
function createToggleHeadingAction(level) {
  const id = `toggle-h${level}`;
  const label = i18next.t("monaco.actions.toggleHeading", { level });
  const keyCode = monaco.KeyCode.Digit1 + (level - 1);
  const prefix = "#".repeat(level) + " ";

  return {
    id,
    label,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | keyCode],
    precondition: null,
    keybindingContext: null,
    run: function (ed) {
      const model = ed.getModel();
      const selections = ed.getSelections();

      ed.pushUndoStop();
      ed.executeEdits(
        id,
        selections
          .map((selection) => {
            const startLine = selection.startLineNumber;
            const endLine = selection.endLineNumber;
            const edits = [];

            for (let line = startLine; line <= endLine; line++) {
              const lineContent = model.getLineContent(line);
              const trimmed = lineContent.trimStart();
              const leadingSpaces = lineContent.slice(0, lineContent.length - trimmed.length);

              const isCurrentHeading = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(trimmed);

              let newText;
              if (isCurrentHeading) {
                newText = trimmed.replace(new RegExp(`^${prefix}`), "");
              } else {
                newText = trimmed.replace(/^#{1,6}\s*/, "");
                newText = prefix + newText;
              }

              edits.push({
                range: new monaco.Range(line, 1, line, lineContent.length + 1),
                text: leadingSpaces + newText,
              });
            }

            return edits;
          })
          .flat(),
      );
      ed.pushUndoStop();
    },
  };
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

function normalizeTextForModelComparison(text) {
  return (typeof text === "string" ? text : "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isDefaultThemeName(theme) {
  return DEFAULT_THEME_NAMES.includes(theme);
}

function normalizeNoteBadgeMask(mask) {
  const value = Number(mask);
  return Number.isInteger(value) ? value & 15 : 0;
}

function getNoteBadgeClass(mask) {
  const value = normalizeNoteBadgeMask(mask);
  return [
    value & 1 ? "has-top" : "",
    value & 2 ? "has-right" : "",
    value & 4 ? "has-bottom" : "",
    value & 8 ? "has-left" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createNoteBadgeElement(mask, className = "") {
  const badge = document.createElement("span");
  badge.className = ["note-badge", getNoteBadgeClass(mask), className].filter(Boolean).join(" ");
  badge.dataset.badgeMask = String(normalizeNoteBadgeMask(mask));
  for (const edge of NOTE_BADGE_EDGES) {
    const edgeEl = document.createElement("span");
    edgeEl.className = `note-badge-edge ${edge.key}`;
    badge.appendChild(edgeEl);
  }
  return badge;
}

function ensureNoteBadgeContextButtons() {
  const container = noteContextMenu?.querySelector(".note-context-badge-buttons");
  if (!container || container.dataset.initialized === "true") return;
  const fragment = document.createDocumentFragment();
  for (const edge of NOTE_BADGE_EDGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-badge-edge-button";
    button.dataset.edge = edge.key;
    button.appendChild(createNoteBadgeElement(edge.bit, "note-context-badge"));
    fragment.appendChild(button);
  }
  container.appendChild(fragment);
  container.dataset.initialized = "true";
}

function getCurrentNoteCreationBadgeMask() {
  return noteBadgeFilter === NOTE_BADGE_ALL_FILTER ? 0 : normalizeNoteBadgeMask(noteBadgeFilter);
}

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

const NOTE_TITLE_MAX_LENGTH = 100;

function truncateNoteTitle(title) {
  const value = String(title || "").trim();
  if (value.length <= NOTE_TITLE_MAX_LENGTH) return value;
  return `${value.slice(0, NOTE_TITLE_MAX_LENGTH)}...`;
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

function formatNoteUpdatedAt(updatedAt) {
  if (!updatedAt) return "";
  try {
    return new Date(updatedAt).toLocaleString();
  } catch {
    return "";
  }
}

function updateNoteTabTitle(tab, content = null) {
  if (!tab?.isNote) return;
  const title = truncateNoteTitle(getNoteTitleFromContent(content ?? tab.model?.getValue() ?? tab.content ?? ""));
  tab.name = title;
  tab.noteTitle = title;
  const nameSpan = tab.element?.querySelector(".name");
  if (nameSpan) {
    nameSpan.textContent = title;
    nameSpan.title = title;
  }
}

function updateNoteBadgeElement(badge, mask) {
  if (!badge) return;
  const className = [
    "note-badge",
    getNoteBadgeClass(mask),
    badge.classList.contains("tab-note-badge") ? "tab-note-badge" : "",
    badge.classList.contains("note-list-badge") ? "note-list-badge" : "",
  ]
    .filter(Boolean)
    .join(" ");
  badge.className = className;
  badge.dataset.badgeMask = String(normalizeNoteBadgeMask(mask));
}

function updateTabNoteBadge(tab) {
  if (!tab?.element) return;
  updateNoteBadgeElement(tab.element.querySelector(".tab-note-badge"), tab.noteBadgeMask);
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
  clearPendingSelfSave(tab);
  tab.element.querySelector(".name")?.classList.remove("warn");
  tab.element.querySelector(".close")?.classList.remove("show-unsaved");
  reloadButton(tab, null, "remove");
  if (tab === currentTab) updateStatusBar();
}

function normalizeFileReadResult(result) {
  if (result === null || result === undefined) return null;
  if (typeof result === "string") {
    return {
      content: result,
      encoding: "UTF-8",
      isUtf8Valid: true,
      hasBom: false,
    };
  }
  if (typeof result === "object" && typeof result.content === "string") {
    return {
      content: result.content,
      encoding: result.encoding || (result.isUtf8Valid === false ? "Invalid UTF-8" : "UTF-8"),
      isUtf8Valid: result.isUtf8Valid !== false,
      hasBom: Boolean(result.hasBom),
    };
  }
  return null;
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
        badgeMask: tab.noteBadgeMask,
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
      badgeMask: tab.noteBadgeMask,
    });
    if (!result?.success) return false;

    tab.notePath = result.path || tab.notePath;
    tab.noteUpdatedAt = result.meta?.updatedAt || Date.now();
    tab.noteCreatedAt = result.meta?.createdAt || tab.noteCreatedAt;
    tab.noteBadgeMask = normalizeNoteBadgeMask(result.meta?.badgeMask ?? tab.noteBadgeMask);
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

function sortNotesForPanel(notes = []) {
  return [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
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
  tab.noteTitle = title;
  tab.noteCreatedAt = note.meta?.createdAt || Date.now();
  tab.noteUpdatedAt = note.meta?.updatedAt || Date.now();
  tab.noteBadgeMask = normalizeNoteBadgeMask(note.meta?.badgeMask);
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
  updateTabNoteBadge(tab);
}

function applyPendingNoteDataToTab(tab, content = "", options = {}) {
  const title = getNoteTitleFromContent(content);
  tab.isNote = true;
  tab.noteId = null;
  tab.notePath = null;
  tab.noteTitle = title;
  tab.noteCreatedAt = null;
  tab.noteUpdatedAt = null;
  tab.noteBadgeMask = normalizeNoteBadgeMask(options.badgeMask);
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
  updateTabNoteBadge(tab);
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
  }

  normalizePinnedTabs();
  if (tabData.length) switchTab(tabData[0]);
}

function updateDeviceShareButtonState() {
  if (!deviceShareBtn) return;

  const hasMeaningfulText = getCurrentEditorText().trim().length > 0;
  deviceShareBtn.disabled = !hasMeaningfulText;
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
window.triggerFind = function () {
  monacoEditor.getAction("actions.find").run();
};
document.getElementById("triggerFindBtn").addEventListener("click", triggerFind);

// call Replace from menu
window.triggerReplace = function () {
  monacoEditor.getAction("editor.action.startFindReplaceAction").run();
};
document.getElementById("triggerReplaceBtn").addEventListener("click", triggerReplace);

// call Go to Line from menu
window.triggerGoToLine = function () {
  monacoEditor?.focus();
  monacoEditor.getAction("editor.action.gotoLine").run();
};
document.getElementById("triggerGoToLineBtn").addEventListener("click", triggerGoToLine);

// call Go to Symbol from menu
window.triggerGoToSymbol = function () {
  monacoEditor?.focus();
  monacoEditor.getAction("editor.action.quickOutline").run();
};
document.getElementById("triggerGoToSymbolBtn").addEventListener("click", triggerGoToSymbol);

// call Quick Open from menu
window.triggerQuickOpen = function () {
  openQuickOpenPicker();
};
document.getElementById("triggerQuickOpenBtn").addEventListener("click", triggerQuickOpen);

// call Command Palette from menu
window.triggerShowCommands = function () {
  monacoEditor?.focus();
  monacoEditor.trigger("keyboard", "editor.action.quickCommand", {});
};
document.getElementById("triggerShowCommandsBtn").addEventListener("click", triggerShowCommands);

let monacoQuickInputActionDisposables = [];

function registerMonacoQuickInputActions() {
  disposeMonacoActions(monacoQuickInputActionDisposables);

  monacoQuickInputActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.quickOpen",
      label: i18next.t("monaco.actions.quickOpen"),
      alias: "Quick Open",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      run: () => {
        openQuickOpenPicker();
      },
    }),
  );

  monacoQuickInputActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.showCommands",
      label: i18next.t("monaco.actions.showCommands"),
      alias: "Command List",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP],
      run: () => {
        triggerShowCommands();
      },
    }),
  );
}

registerMonacoQuickInputActions();

let activeQuickOpenPicker = null;

function getPathBasename(filePath) {
  return (
    String(filePath || "")
      .split(/[/\\]/)
      .pop() || String(filePath || "")
  );
}

function getQuickOpenNoteTitle(note) {
  return truncateNoteTitle(note?.title || getDefaultNoteTitle());
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
  return {
    label: `$(notebook) ${title}`,
    description: i18next.t("monaco.quickOpen.notes"),
    tooltip: title,
    ariaLabel: `${title} ${i18next.t("monaco.quickOpen.notes")}`,
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
      pushNote(notesById.get(tab.noteId) || { id: tab.noteId, title: tab.name }, 1);
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

notesListRefreshButton?.addEventListener("click", async () => {
  await refreshNotesListNow();
});
notesBadgeToggleButton?.addEventListener("click", () => {
  areNoteBadgesVisible = !areNoteBadgesVisible;
  localStorage.setItem(NOTE_BADGE_STORAGE_KEY, String(areNoteBadgesVisible));
  updateNoteBadgeToggleButton();
});
notesBadgeFilterBar?.addEventListener(
  "wheel",
  (e) => {
    if (!notesBadgeFilterBar || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    notesBadgeFilterBar.scrollLeft += e.deltaY;
    e.preventDefault();
  },
  { passive: false },
);

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
    noteContextMenu.style.display = "none";
    rightClickedNoteId = null;
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
    noteContextMenu.style.display = "none";
    rightClickedNoteId = null;
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

function stopDeviceShareCountdown() {
  if (deviceShareCountdownTimer) {
    clearInterval(deviceShareCountdownTimer);
    deviceShareCountdownTimer = null;
  }
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateDeviceShareRegenerateButton() {
  if (!deviceShareRegenerate) return;

  if (!deviceShareExpiresAt && !activeDeviceShareUrl) {
    deviceShareRegenerate.disabled = true;
    deviceShareRegenerate.textContent = i18next.t("deviceShare.regenerate");
    return;
  }

  const remainingMs = deviceShareExpiresAt ? deviceShareExpiresAt - Date.now() : 0;
  if (remainingMs > 0) {
    deviceShareRegenerate.disabled = true;
    deviceShareRegenerate.textContent = `${i18next.t("deviceShare.regenerate")} (${formatRemainingTime(remainingMs)})`;
    return;
  }

  stopDeviceShareCountdown();
  deviceShareRegenerate.disabled = false;
  deviceShareRegenerate.innerHTML = `${i18next.t("deviceShare.regenerate")} <span id="device-share-expired">(${i18next.t(
    "deviceShare.expired",
  )})</span>`;
}

async function syncDeviceShareStatus() {
  if (!activeDeviceShareUrl || deviceShareStatusSyncing) return;

  deviceShareStatusSyncing = true;
  try {
    const status = await window.electronAPI.getMobileShareStatus(activeDeviceShareUrl);
    if (!status?.exists || status.expired) {
      deviceShareExpiresAt = Date.now();
      updateDeviceShareRegenerateButton();
      return;
    }
    if (typeof status.expiresAt === "number" && status.expiresAt !== deviceShareExpiresAt) {
      deviceShareExpiresAt = status.expiresAt;
      updateDeviceShareRegenerateButton();
    }
  } finally {
    deviceShareStatusSyncing = false;
  }
}

function startDeviceShareCountdown(expiresAt) {
  deviceShareExpiresAt = expiresAt || null;
  stopDeviceShareCountdown();
  updateDeviceShareRegenerateButton();
  deviceShareCountdownTimer = setInterval(() => {
    updateDeviceShareRegenerateButton();
    syncDeviceShareStatus();
  }, 1000);
}

function resetDeviceShareCopyButton() {
  if (!deviceShareCopy) return;
  clearTimeout(deviceShareCopyResetTimer);
  deviceShareCopy.textContent = i18next.t("deviceShare.copyLink");
}

function setDeviceShareCopyButtonCopied() {
  if (!deviceShareCopy) return;
  clearTimeout(deviceShareCopyResetTimer);
  deviceShareCopy.textContent = i18next.t("deviceShare.copied");
  deviceShareCopyResetTimer = setTimeout(resetDeviceShareCopyButton, 1200);
}

function setDeviceShareLinkContentVisible(visible) {
  if (deviceShareQrWrap) deviceShareQrWrap.style.display = visible ? "flex" : "none";
  if (deviceShareUrlRow) deviceShareUrlRow.style.display = visible ? "flex" : "none";
}

function resetDeviceShareModal() {
  deviceShareQr.removeAttribute("src");
  deviceShareUrl.value = "";
  deviceShareError.style.display = "none";
  deviceShareError.textContent = "";
  deviceShareDescription.textContent = i18next.t("deviceShare.description");
  resetDeviceShareCopyButton();
  stopDeviceShareCountdown();
  deviceShareExpiresAt = null;
  deviceShareRegenerate.disabled = true;
  deviceShareRegenerate.textContent = i18next.t("deviceShare.regenerate");
  setDeviceShareLinkContentVisible(true);
}

function getDeviceShareErrorMessage(result) {
  if (result?.errorKey === "tooLarge") {
    return i18next.t("deviceShare.tooLarge", { maxMb: result.maxMb || 2 });
  }
  return i18next.t("deviceShare.createError");
}

function getDirectShareUrl(text) {
  const trimmed = (typeof text === "string" ? text : "").trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (new Blob([trimmed]).size > DEVICE_SHARE_DIRECT_URL_MAX_BYTES) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

async function closeDeviceShareModal() {
  confirmBox.style.display = "none";
  deviceShareModal.style.display = "none";
  isModalDisplayed = false;
  stopDeviceShareCountdown();
  deviceShareExpiresAt = null;

  if (activeDeviceShareUrl) {
    await window.electronAPI.revokeMobileShare(activeDeviceShareUrl);
    activeDeviceShareUrl = null;
  }

  monacoEditor?.focus();
}

async function createDeviceShareLink() {
  if (!monacoEditor || !currentTab) return;

  if (activeDeviceShareUrl) {
    await window.electronAPI.revokeMobileShare(activeDeviceShareUrl);
    activeDeviceShareUrl = null;
  }

  deviceShareDescription.textContent = i18next.t("deviceShare.preparing");
  setDeviceShareLinkContentVisible(false);
  deviceShareRegenerate.disabled = true;
  deviceShareRegenerate.textContent = i18next.t("deviceShare.regenerate");
  resetDeviceShareCopyButton();

  const title = currentTab.name || "Monapad Note";
  const text = monacoEditor.getModel() === currentTab.model ? monacoEditor.getValue() : currentTab.model.getValue();
  const directUrl = getDirectShareUrl(text);

  if (directUrl) {
    activeDeviceShareUrl = null;
    deviceShareUrl.value = directUrl;
    deviceShareQr.src = await QRCode.toDataURL(directUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: {
        dark: getCSSVar("--editorText") || "#ffffff",
        light: getCSSVar("--color2") || "#000000",
      },
    });
    setDeviceShareLinkContentVisible(true);
    stopDeviceShareCountdown();
    deviceShareExpiresAt = null;
    deviceShareDescription.textContent = i18next.t("deviceShare.directLinkDescription");
    deviceShareRegenerate.disabled = true;
    deviceShareRegenerate.textContent = i18next.t("deviceShare.regenerate");
    return;
  }

  const result = await window.electronAPI.createMobileShare({
    title,
    text,
    labels: {
      copy: i18next.t("deviceShare.pageCopy"),
      copied: i18next.t("deviceShare.pageCopied"),
    },
  });

  if (!result?.success) {
    deviceShareDescription.textContent = "";
    deviceShareError.textContent = getDeviceShareErrorMessage(result);
    deviceShareError.style.display = "block";
    deviceShareRegenerate.disabled = false;
    deviceShareRegenerate.textContent = i18next.t("deviceShare.regenerate");
    return;
  }

  activeDeviceShareUrl = result.url;
  deviceShareUrl.value = result.url;
  deviceShareQr.src = await QRCode.toDataURL(result.url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: getCSSVar("--editorText") || "#ffffff",
      light: getCSSVar("--color2") || "#000000",
    },
  });
  setDeviceShareLinkContentVisible(true);
  deviceShareDescription.textContent = i18next.t("deviceShare.description");
  startDeviceShareCountdown(result.expiresAt);
}

async function openDeviceShareModal() {
  if (!monacoEditor || !currentTab) return;
  if (!getCurrentEditorText().trim()) {
    updateDeviceShareButtonState();
    return;
  }

  confirmBox.style.display = "flex";
  deviceShareModal.style.display = "flex";
  isModalDisplayed = true;
  resetDeviceShareModal();
  await createDeviceShareLink();
}

deviceShareBtn?.addEventListener("click", openDeviceShareModal);
deviceShareClose?.addEventListener("click", closeDeviceShareModal);
deviceShareRegenerate?.addEventListener("click", async () => {
  if (deviceShareRegenerate.disabled) return;
  await createDeviceShareLink();
});
deviceShareCopy?.addEventListener("click", async () => {
  if (!deviceShareUrl.value) return;

  try {
    await navigator.clipboard.writeText(deviceShareUrl.value);
    setDeviceShareCopyButtonCopied();
  } catch (err) {
    deviceShareUrl.focus();
    deviceShareUrl.select();
  }
});

// window controls
const maxButton = document.getElementById("max-button");
const maxButtonIcon = maxButton?.querySelector(".codicon");

function updateMaximizeButtonIcon(isMaximized) {
  if (!maxButton || !maxButtonIcon) return;
  maxButtonIcon.classList.toggle("codicon-chrome-maximize", !isMaximized);
  maxButtonIcon.classList.toggle("codicon-chrome-restore", Boolean(isMaximized));
  const label = isMaximized ? "Restore" : "Maximize";
  maxButton.setAttribute("aria-label", label);
  maxButton.title = label;
}

document.getElementById("min-button").addEventListener("click", () => {
  window.electronAPI.minimizeWindow();
});

maxButton.addEventListener("click", () => {
  window.electronAPI.toggleMaximizeWindow();
});

document.getElementById("close-button").addEventListener("click", () => {
  attemptCloseWindow();
});

window.electronAPI.onWindowMaximizeState(updateMaximizeButtonIcon);
window.electronAPI.isWindowMaximized?.().then(updateMaximizeButtonIcon);

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

  const hoveredTab = e.target.closest(".tab");
  if (hoveredTab) {
    const allTabs = tabs.querySelectorAll(".tab");
    isHoveringLastTab = hoveredTab === allTabs[allTabs.length - 1];
  } else {
    isHoveringLastTab = false;
  }
});
function handleTabsMouseLeave() {
  tabAreaHovered = false;
  isHoveringLastTab = false;
  fixedTabsWidth = null;
  pendingTabsWidthAfterClose = null;
  tabs.style.maxWidth = "";
  updateTabsCompactClass();
}
function isMouseInsideTabsContainer() {
  const rect = tabsContainer.getBoundingClientRect();
  return mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
}
tabsContainer.addEventListener("mouseleave", () => {
  handleTabsMouseLeave();
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

  if (currentTab?.isNote) {
    const updated = formatNoteUpdatedAt(currentTab.noteUpdatedAt);
    const noteStatus = updated ? `${updated} • Note: ${currentTab.name}` : `Note: ${currentTab.name}`;
    if (statusPathEl) statusPathEl.textContent = noteStatus;
    if (statusPathEl) statusPathEl.title = currentTab.name;
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
  lineColEl.textContent = `${i18next.t("statusBar.line")} ${position.lineNumber}, ${i18next.t("statusBar.col")} ${
    position.column
  }${selectionText}`;
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
  left = Math.max(0, Math.min(left, tabsRect.width));
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
  const tabsRect = tabs.getBoundingClientRect();

  if (localClientX <= tabsRect.left) {
    showDropIndicator(tabsRect.left, excludeTab, true, tabForPlacement);
    return;
  }

  if (localClientX >= tabsRect.right) {
    showDropIndicator(tabsRect.right, excludeTab, true, tabForPlacement);
    return;
  }

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

  tab.addEventListener("mousedown", async (e) => {
    if (e.button !== 0 || isTabControlTarget(e.target) || draggingTab) return;
    // console.log("📌mousedown: start");
    isHandlingMouseDown = true;
    tabPendingDeferredMouseUp = tab;
    dragStartClientPos = { x: e.clientX, y: e.clientY };
    switchTab(data);
    draggingTab = tab;
    // console.log("📌mousedown: draggingTab set");
    draggingTabData = data;
    draggingTabWasPinned = Boolean(data.isPinned);
    tabOrderChangedDuringDrag = false;
    document.body.classList.add("tab-dragging");
    dragIndex = tabData.indexOf(data);
    wasOnlyTab = tabData.length === 1;
    startX = e.clientX;
    currentX = 0;
    tab.style.transition = "none";
    tab.style.position = "relative";
    windowBoundsCache = await window.electronAPI.getMyBounds();
    cachedToolbarRect = toolbar.getBoundingClientRect();
    externalCancelDragging = handleCancelDraggingByShortcut;
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

  function onMouseMove(e) {
    if (!draggingTab) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const toolbarRect = cachedToolbarRect;
    const isOutsideToolbar =
      mouseX < toolbarRect.left ||
      mouseX > toolbarRect.right - windowControls.offsetWidth ||
      mouseY < toolbarRect.top ||
      mouseY > toolbarRect.bottom + toolbarRect.height / 2;

    if (isOutsideToolbar) {
      hideDropIndicator();
      tabs.classList.remove("dragging");
      draggingTab.style.opacity = "0.5";
      overlayWindowVisible = true;
      window.electronAPI.createCursorWindow();

      if (shouldCheckWindow()) {
        const isWarn = draggingTabData.isWarned || draggingTabData.isPinned;
        window.electronAPI.getWindowIdAt({ x: e.screenX, y: e.screenY }).then(async (targetWindowId) => {
          if (!windowBoundsCache) {
            setExternalPreviewTargetWindow(null);
            return;
          }
          const myBounds = windowBoundsCache;
          const isInMyWindow =
            e.screenX >= myBounds.x &&
            e.screenX <= myBounds.x + myBounds.width &&
            e.screenY >= myBounds.y &&
            e.screenY <= myBounds.y + myBounds.height;

          let isTargetMinimized = false;
          if (targetWindowId) {
            isTargetMinimized = await window.electronAPI.isWindowMinimized(targetWindowId);
          }

          let state = "";
          if (isWarn) {
            state = "forbidden";
          } else if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow && !isTargetMinimized) {
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

      currentX = mouseX - startX;
      draggingTab.style.transform = `translateX(${currentX}px)`;
    }

    const tabsArray = Array.from(tabs.children).filter((el) => el.classList.contains("tab"));
    const currentRect = draggingTab.getBoundingClientRect();
    for (let i = 0; i < tabsArray.length; i++) {
      const targetTab = tabsArray[i];
      if (targetTab === draggingTab) continue;
      const targetTabData = tabData.find((candidate) => candidate.element === targetTab);
      if (targetTabData && Boolean(targetTabData.isPinned) !== Boolean(draggingTabData.isPinned)) continue;

      const targetRect = targetTab.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;

      if (currentX > 0 && currentRect.right > targetCenter && i > dragIndex) {
        const oldLeft = currentRect.left;

        tabs.insertBefore(draggingTab, targetTab.nextSibling);
        monacoEditor.getDomNode()?.blur();
        switchTab(currentTab);

        const newRect = draggingTab.getBoundingClientRect();
        const deltaX = oldLeft - newRect.left;

        currentX += deltaX;
        draggingTab.style.transform = `translateX(${currentX}px)`;

        [tabData[dragIndex], tabData[i]] = [tabData[i], tabData[dragIndex]];
        updateTabAdjacencyClasses();
        scheduleAllUnsavedTabAutosaves();
        tabOrderChangedDuringDrag = true;
        dragIndex = i;
        startX = e.clientX - currentX;

        break;
      } else if (currentX < 0 && currentRect.left < targetCenter && i < dragIndex) {
        const oldLeft = currentRect.left;

        tabs.insertBefore(draggingTab, targetTab);
        monacoEditor.getDomNode()?.blur();
        switchTab(currentTab);

        const newRect = draggingTab.getBoundingClientRect();
        const deltaX = oldLeft - newRect.left;

        currentX += deltaX;
        draggingTab.style.transform = `translateX(${currentX}px)`;

        [tabData[dragIndex], tabData[i]] = [tabData[i], tabData[dragIndex]];
        updateTabAdjacencyClasses();
        scheduleAllUnsavedTabAutosaves();
        tabOrderChangedDuringDrag = true;
        dragIndex = i;
        startX = e.clientX - currentX;

        break;
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
      document.body.classList.remove("tab-dragging");
      dragStartClientPos = null;
      externalCancelDragging = null;
      return;
    }

    const isWarn = draggingTabData.isWarned || draggingTabData.isPinned;
    const releasedTabData = tabData.find((t) => t.element === draggingTab);

    draggingTab.style.transition = "";
    draggingTab.style.transform = "";
    draggingTab.style.position = "";
    draggingTab.style.pointerEvents = "";
    draggingTab.style.opacity = "1";
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
    cachedToolbarRect = null;
    externalCancelDragging = null;
    dragIndex = -1;

    if (isWarn || !releasedTabData || !windowBoundsCache) {
      dragStartClientPos = null;
      return;
    }

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const toolbarRect = toolbar.getBoundingClientRect();
    const isOutsideToolbar =
      mouseX < toolbarRect.left ||
      mouseX > toolbarRect.right - windowControls.offsetWidth ||
      mouseY < toolbarRect.top ||
      mouseY > toolbarRect.bottom + toolbarRect.height / 2;

    const myBounds = windowBoundsCache;
    const isInMyWindow =
      e.screenX >= myBounds.x &&
      e.screenX <= myBounds.x + myBounds.width &&
      e.screenY >= myBounds.y &&
      e.screenY <= myBounds.y + myBounds.height;

    windowBoundsCache = null;

    if (!isOutsideToolbar) {
      normalizePinnedTabs();
      if (tabOrderChangedDuringDrag) scheduleGlobalSearchAfterTabSetChange();
      dragStartClientPos = null;
      return;
    }

    // get window id from cursor position
    window.electronAPI
      .getWindowIdAt({ x: e.screenX, y: e.screenY })
      .then(async (targetWindowId) => {
        if (targetWindowId && targetWindowId !== myWindowId && !isInMyWindow) {
          if (releasedTabData.isNotePreview) keepOpenNoteTab(releasedTabData);
          await writeTabAutosave(releasedTabData);
          // send tab to window on drop
          const tabInfo = {
            name: releasedTabData.name,
            content: releasedTabData.model.getValue(),
            path: releasedTabData.path,
            isNote: releasedTabData.isNote,
            noteId: releasedTabData.noteId,
            notePath: releasedTabData.notePath,
            noteTitle: releasedTabData.noteTitle,
            noteCreatedAt: releasedTabData.noteCreatedAt,
            noteUpdatedAt: releasedTabData.noteUpdatedAt,
            isFileSaved: releasedTabData.isFileSaved,
            originalContent: releasedTabData.originalContent,
            fontSize: releasedTabData.fontSize,
            wordWrap: releasedTabData.wordWrap,
            isMarkdown: releasedTabData.isMarkdown,
            draftId: releasedTabData.draftId,
            hasReloadButton: releasedTabData.element?.classList.contains("has-reload-button"),
          };
          window.electronAPI
            .sendTabToWindow(targetWindowId, {
              tabInfo,
              dropScreenX: e.screenX,
              dropScreenY: e.screenY,
            })
            .then(() => {
              window.electronAPI.focusWindow(targetWindowId);
            });

          removeTabAndAdjustUI(releasedTabData);

          if (wasOnlyTab) {
            attemptCloseWindow();
          }
        } else if (isOutsideToolbar) {
          if (wasOnlyTab) return;
          if (releasedTabData.isNotePreview) keepOpenNoteTab(releasedTabData);
          const position = dragStartClientPos
            ? {
                x: e.screenX - dragStartClientPos.x,
                y: e.screenY - dragStartClientPos.y,
              }
            : { x: e.screenX, y: e.screenY };
          openTabInNewWindow(releasedTabData, position);
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

    if (!draggingTab) {
      document.body.classList.remove("tab-dragging");
      dragStartClientPos = null;
      externalCancelDragging = null;
      return;
    }

    draggingTab.style.transition = "";
    draggingTab.style.transform = "";
    draggingTab.style.position = "";
    draggingTab.style.pointerEvents = "";
    draggingTab.style.opacity = "1";
    tabs.classList.remove("dragging");
    document.body.classList.remove("tab-dragging");

    if (overlayWindowVisible) {
      overlayWindowVisible = false;
      resetCursorWindowMove();
      window.electronAPI.destroyCursorWindow();
    }

    draggingTab = null;
    draggingTabData = null;
    draggingTabWasPinned = false;
    cachedToolbarRect = null;
    dragStartClientPos = null;
    externalCancelDragging = null;
    dragIndex = -1;
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
  await writeTabAutosave(targetTabData);

  const tabInfo = {
    name: targetTabData.name,
    content: targetTabData.model.getValue(),
    path: targetTabData.path,
    isNote: targetTabData.isNote,
    noteId: targetTabData.noteId,
    notePath: targetTabData.notePath,
    noteTitle: targetTabData.noteTitle,
    noteCreatedAt: targetTabData.noteCreatedAt,
    noteUpdatedAt: targetTabData.noteUpdatedAt,
    isFileSaved: targetTabData.isFileSaved,
    originalContent: targetTabData.originalContent,
    fontSize: targetTabData.fontSize,
    wordWrap: targetTabData.wordWrap,
    isMarkdown: targetTabData.isMarkdown,
    draftId: targetTabData.draftId,
    hasReloadButton: targetTabData.element?.classList.contains("has-reload-button"),
  };

  await window.electronAPI.createNewWindowWithTab(tabInfo, position);
  removeTabAndAdjustUI(targetTabData);
}

function removeTabAndAdjustUI(targetTabData) {
  const index = tabData.indexOf(targetTabData);
  if (index === -1) return;

  clearAutosaveTimer(targetTabData);
  tabs.removeChild(targetTabData.element);
  tabData.splice(index, 1);
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
    fixedTabsWidth = null;
    tabs.style.maxWidth = "";
    switchTab(tabData[0]);
    setTimeout(() => monacoEditor?.focus(), 0);
  }
}

// add compact class to tabs when tab width is less than 50 px
function updateTabsCompactClass() {
  const tabElements = tabs.querySelectorAll(".tab");
  if (tabElements.length === 0) return;

  const tabWidth = tabElements[0].offsetWidth;
  tabs.classList.toggle("compact", tabWidth <= 60);
}

function prepareTabsWidthForClose(tab, keepCurrentWidth = false) {
  const tabsWidth = tabs.getBoundingClientRect().width;
  const tabWidth = tab.getBoundingClientRect().width;
  pendingTabsWidthAfterClose = keepCurrentWidth ? tabsWidth : Math.max(0, tabsWidth - tabWidth);
}

function applyPendingTabsWidthAfterClose() {
  if (pendingTabsWidthAfterClose === null) return;
  fixedTabsWidth = pendingTabsWidthAfterClose;
  tabs.style.maxWidth = `${fixedTabsWidth}px`;
  pendingTabsWidthAfterClose = null;
}

function clearPendingTabsWidthAfterClose() {
  pendingTabsWidthAfterClose = null;
}

// create tab
function createTab(name, content = "", path = null, insertIndex = null, options = {}) {
  if (!name) name = `${i18next.t("file.untitled")}.txt`;
  const targetInsertIndex = clampUnpinnedTabInsertIndex(insertIndex);

  // reset tabs max width
  fixedTabsWidth = null;
  pendingTabsWidthAfterClose = null;
  tabs.style.maxWidth = "";

  const tab = document.createElement("div");
  tab.className = "tab";

  const nameSpan = document.createElement("span");
  nameSpan.className = "name";
  nameSpan.textContent = name;
  nameSpan.title = name;
  const noteBadge = createNoteBadgeElement(0, "tab-note-badge");
  const nameWrap = document.createElement("div");
  nameWrap.className = "name-wrap";
  nameWrap.append(noteBadge, nameSpan);

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

  tab.appendChild(nameWrap);
  tab.appendChild(close);

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
    noteBadgeMask: 0,
  };

  if (targetInsertIndex !== null && targetInsertIndex >= 0 && targetInsertIndex < tabData.length) {
    const referenceTab = tabData[targetInsertIndex].element;
    tabs.insertBefore(tab, referenceTab);
    tabData.splice(targetInsertIndex, 0, data);
  } else {
    tabs.appendChild(tab);
    tabData.push(data);
  }

  close.onclick = async (e) => {
    e.stopPropagation();
    if (data.isPinned) {
      setTabPinned(data, false);
      return;
    }

    clearPendingTabsWidthAfterClose();
    if (tabAreaHovered && !isHoveringLastTab) {
      // set current tabs width - current tab width to tabs max width before closing tab
      prepareTabsWidthForClose(tab);
    } else if (tabAreaHovered && isHoveringLastTab) {
      // keep max width when last tab is closed
      prepareTabsWidthForClose(tab, true);
    }

    await attemptCloseTab(data);
    clearPendingTabsWidthAfterClose();

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

      clearPendingTabsWidthAfterClose();
      if (tabAreaHovered && !isHoveringLastTab) {
        prepareTabsWidthForClose(tab);
      } else if (tabAreaHovered && isHoveringLastTab) {
        prepareTabsWidthForClose(tab, true);
      }

      await attemptCloseTab(data);
      clearPendingTabsWidthAfterClose();

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

async function createNoteTab(content = "", insertIndex = null, existingNote = null, options = {}) {
  const title = existingNote?.meta?.title || getNoteTitleFromContent(content);
  let note = existingNote;
  const badgeMask = normalizeNoteBadgeMask(existingNote?.meta?.badgeMask ?? options.badgeMask);

  if (!note && content.trim()) {
    note = await window.electronAPI.createNote({ content, title, badgeMask });
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
      applyPendingNoteDataToTab(reusableTab, noteContent, { ...options, badgeMask });
    }
    if (reusableTab === currentTab) {
      currentFilePath = `Note: ${reusableTab.name}`;
      updateStatusBar();
    }
    renderNotesList();
    return reusableTab;
  }

  if (!note) {
    const data = createPendingNoteTab(noteContent, insertIndex, { ...options, badgeMask });
    renderNotesList();
    return data;
  }

  const data = createTab(title, noteContent, null, insertIndex);
  applyNoteDataToTab(data, note, noteContent, options);
  renderNotesList();
  return data;
}

async function createNewNote() {
  const data = await createNoteTab("", null, null, { preview: false, badgeMask: getCurrentNoteCreationBadgeMask() });
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

  const note = await window.electronAPI.createNote({ content, title: getNoteTitleFromContent(content) });
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
async function attemptCloseTab(data) {
  return new Promise(async (resolve) => {
    if (data?.isPinned) {
      resolve("pinned");
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
      tabs.removeChild(tab);
      applyPendingTabsWidthAfterClose();
      updateTabsCompactClass();
      if (data.model) data.model.dispose();
      tabData = tabData.filter((t) => t !== data);
      scheduleAllUnsavedTabAutosaves();
      scheduleGlobalSearchAfterTabSetChange();
      syncRecentlyClosedFilesState();

      if (tab.classList.contains("active")) {
        if (tabData.length) {
          const newIndex = index === tabData.length ? Math.max(index - 1, 0) : index;
          switchTab(tabData[newIndex]);
          setTimeout(() => monacoEditor?.focus(), 0);
        } else {
          currentTab = null;
          createDefaultEmptyTab({ switchTo: false });
          fixedTabsWidth = null;
          tabs.style.maxWidth = "";
          switchTab(tabData[0]);
          setTimeout(() => monacoEditor?.focus(), 0);
        }
      } else {
        const currentActive = tabData.find((t) => t.element.classList.contains("active"));
        if (currentActive) {
          updateTabAdjacencyClasses();
          setTimeout(() => monacoEditor?.focus(), 0);
        }
      }

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
        tabs.removeChild(tab);
        applyPendingTabsWidthAfterClose();
        updateTabsCompactClass();
        if (data.model) data.model.dispose();
        tabData = tabData.filter((t) => t !== data);
        scheduleAllUnsavedTabAutosaves();
        scheduleGlobalSearchAfterTabSetChange();
        syncRecentlyClosedFilesState();

        if (tab.classList.contains("active")) {
          if (tabData.length) {
            const newIndex = index === tabData.length ? Math.max(index - 1, 0) : index;
            switchTab(tabData[newIndex]);
            setTimeout(() => monacoEditor?.focus(), 0);
          } else {
            currentTab = null;
            createDefaultEmptyTab({ switchTo: false });

            // reset max width when last tab is closed
            fixedTabsWidth = null;
            tabs.style.maxWidth = "";

            switchTab(tabData[0]);
            setTimeout(() => monacoEditor?.focus(), 0);
          }
        } else {
          const currentActive = tabData.find((t) => t.element.classList.contains("active"));
          if (currentActive) {
            updateTabAdjacencyClasses();
            setTimeout(() => monacoEditor?.focus(), 0);
          }
        }
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
    tabs.removeChild(tab);
    applyPendingTabsWidthAfterClose();
    updateTabsCompactClass();
    if (data.model) data.model.dispose();
    tabData = tabData.filter((t) => t !== data);
    scheduleAllUnsavedTabAutosaves();
    scheduleGlobalSearchAfterTabSetChange();
    syncRecentlyClosedFilesState();

    if (tab.classList.contains("active")) {
      if (tabData.length) {
        const newIndex = index === tabData.length ? Math.max(index - 1, 0) : index;
        switchTab(tabData[newIndex]);
        setTimeout(() => monacoEditor?.focus(), 0);
      } else {
        currentTab = null;
        createDefaultEmptyTab({ switchTo: false });

        // reset max width when last tab is closed
        fixedTabsWidth = null;
        tabs.style.maxWidth = "";

        switchTab(tabData[0]);
        setTimeout(() => monacoEditor?.focus(), 0);
      }
    } else {
      const currentActive = tabData.find((t) => t.element.classList.contains("active"));
      if (currentActive) {
        updateTabAdjacencyClasses();
        setTimeout(() => monacoEditor?.focus(), 0);
      }
    }

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
          nameSpan.textContent = restoredTab.name;
          nameSpan.title = restoredTab.name;
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
  const wrapBtn = document.querySelector('button[data-action="wordWrap"] .checkmark');
  if (wrapBtn) wrapBtn.style.display = isWordWrapOn ? "inline-flex" : "none";

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

    const badgeEl = tab.element.querySelector(".tab-note-badge");
    const nameEl = tab.element.querySelector(".name");
    const referenceEl = badgeEl || nameEl;
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
        nameSpan.textContent = singleTab.name;
        nameSpan.title = singleTab.name;
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

function getVisibleNotesForPanel(notes) {
  if (noteBadgeFilter === NOTE_BADGE_ALL_FILTER) return notes;
  const targetMask = normalizeNoteBadgeMask(noteBadgeFilter);
  return notes.filter((note) => normalizeNoteBadgeMask(note.badgeMask) === targetMask);
}

function getNoteBadgeFilterMasks(notes) {
  const masks = [...new Set(notes.map((note) => normalizeNoteBadgeMask(note.badgeMask)))];
  return masks.sort((a, b) => {
    const countDiff = countNoteBadgeEdges(b) - countNoteBadgeEdges(a);
    if (countDiff) return countDiff;
    return a - b;
  });
}

function countNoteBadgeEdges(mask) {
  let value = normalizeNoteBadgeMask(mask);
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function renderNoteBadgeFilterBar() {
  if (!notesBadgeFilterBar) return;
  notesBadgeFilterBar.innerHTML = "";
  const availableMasks = getNoteBadgeFilterMasks(notesIndexCache);
  const entries = [
    { value: NOTE_BADGE_ALL_FILTER, all: true, title: i18next.t("sidePanel.noteMarkAll") },
    ...availableMasks
      .filter((mask) => mask !== 0)
      .map((mask) => ({ value: mask, title: i18next.t("sidePanel.noteMarkFilter", { mask }) })),
    ...(availableMasks.includes(0) ? [{ value: 0, title: i18next.t("sidePanel.noteMarkNone") }] : []),
  ];

  for (const entry of entries) {
    const button = document.createElement("button");
    button.className = "note-badge-filter-button";
    button.type = "button";
    button.dataset.badgeFilter = String(entry.value);
    button.title = entry.title;
    button.setAttribute("aria-label", entry.title);
    button.classList.toggle("is-active", String(noteBadgeFilter) === String(entry.value));
    const badge = entry.all ? createNoteBadgeElement(15) : createNoteBadgeElement(entry.value);
    if (entry.all) badge.classList.add("is-all");
    button.appendChild(badge);
    button.addEventListener("click", async () => {
      noteBadgeFilter = entry.value;
      localStorage.setItem(NOTE_BADGE_FILTER_STORAGE_KEY, String(noteBadgeFilter));
      await renderNotesList();
    });
    notesBadgeFilterBar.appendChild(button);
  }
}

async function renderNotesList({ scheduleSearch = true } = {}) {
  if (!notesList) return;
  const notes = await window.electronAPI.listNotes();
  notesIndexCache = sortNotesForPanel(Array.isArray(notes) ? notes : []);
  if (noteBadgeFilter !== NOTE_BADGE_ALL_FILTER) {
    const hasFilter = notesIndexCache.some(
      (note) => normalizeNoteBadgeMask(note.badgeMask) === normalizeNoteBadgeMask(noteBadgeFilter),
    );
    if (!hasFilter) noteBadgeFilter = NOTE_BADGE_ALL_FILTER;
  }
  renderNoteBadgeFilterBar();
  notesList.innerHTML = "";

  for (const note of getVisibleNotesForPanel(notesIndexCache)) {
    if (!note?.id) continue;
    const item = document.createElement("div");
    item.className = `note-list-item${note.pinned ? " pinned" : ""}`;
    item.dataset.noteId = note.id;
    item.dataset.badgeMask = String(normalizeNoteBadgeMask(note.badgeMask));

    const badge = createNoteBadgeElement(note.badgeMask, "note-list-badge");

    const title = document.createElement("span");
    title.className = "note-list-title";
    title.textContent = truncateNoteTitle(note.title || getNoteTitleFromContent(""));
    title.title = title.textContent;

    const pinButton = document.createElement("button");
    pinButton.className = `note-pin-button codicon ${note.pinned ? "codicon-pinned" : "codicon-pin"}`;
    pinButton.type = "button";
    const pinLabel = note.pinned ? i18next.t("sidePanel.unpinNote") : i18next.t("sidePanel.pinNote");
    pinButton.setAttribute("aria-label", pinLabel);
    pinButton.title = pinLabel;
    pinButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      await window.electronAPI.updateNoteMeta({ noteId: note.id, pinned: !note.pinned });
      await renderNotesList();
      await populateRecentMenu();
    });

    item.append(badge, title, pinButton);
    item.addEventListener("click", async () => {
      if (suppressNoteClick) return;
      await openNoteById(note.id, { preview: true });
    });
    item.addEventListener("dblclick", async () => {
      if (suppressNoteClick) return;
      await openNoteById(note.id, { preview: false });
    });
    item.addEventListener("auxclick", async (e) => {
      if (e.button !== 1 || suppressNoteClick) return;
      e.preventDefault();
      await openNoteById(note.id, { preview: false });
    });
    item.addEventListener("contextmenu", (e) => showNoteContextMenu(e, note.id));
    item.addEventListener("mousedown", (e) => beginNoteListDrag(e, item));
    notesList.appendChild(item);
  }

  updateActiveNoteListItem();
  updateGlobalSearchActionState();
  if (scheduleSearch && isGlobalSearchActive()) scheduleGlobalSearch();
}

function updateActiveNoteListItem() {
  if (!notesList) return;
  const activeNoteId = currentTab?.isNote && currentTab.noteId ? currentTab.noteId : null;
  notesList.querySelectorAll(".note-list-item").forEach((item) => {
    item.classList.toggle("active-note", Boolean(activeNoteId && item.dataset.noteId === activeNoteId));
  });
}

function resizeGlobalSearchInput() {
  if (!globalSearchInput) return;
  globalSearchInput.style.height = "auto";
  const scrollHeight = globalSearchInput.scrollHeight || GLOBAL_SEARCH_INPUT_MIN_HEIGHT;
  const nextHeight = clampNumber(scrollHeight, GLOBAL_SEARCH_INPUT_MIN_HEIGHT, GLOBAL_SEARCH_INPUT_MAX_HEIGHT);
  globalSearchInput.style.height = `${nextHeight}px`;
  globalSearchInput.style.overflowY = scrollHeight > GLOBAL_SEARCH_INPUT_MAX_HEIGHT ? "auto" : "hidden";
}

function handleGlobalSearchInputChange() {
  globalSearchHistoryIndex = -1;
  globalSearchHistoryDraft = "";
  resizeGlobalSearchInput();
  updateGlobalSearchPlaceholder(true);
  globalSearchState.dismissedMatches.clear();
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  if (!getGlobalSearchQuery()) {
    clearGlobalSearchResults();
    return;
  }
  setGlobalSearchActive(true);
  scheduleGlobalSearch();
}

function insertGlobalSearchInputText(text) {
  if (!globalSearchInput) return;
  const value = globalSearchInput.value || "";
  const start = globalSearchInput.selectionStart ?? value.length;
  const end = globalSearchInput.selectionEnd ?? start;
  globalSearchInput.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const nextPosition = start + text.length;
  globalSearchInput.setSelectionRange(nextPosition, nextPosition);
  handleGlobalSearchInputChange();
}

function shouldKeepGlobalSearchArrowInInput(key) {
  if (!globalSearchInput || !globalSearchInput.value.includes("\n")) return false;
  if (key === "ArrowUp") return (globalSearchInput.selectionStart ?? 0) > 0;
  if (key === "ArrowDown") return (globalSearchInput.selectionEnd ?? 0) < globalSearchInput.value.length;
  return false;
}

globalSearchInput?.addEventListener("input", handleGlobalSearchInputChange);

globalSearchInput?.addEventListener("keydown", (e) => {
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (shouldKeepGlobalSearchArrowInInput(e.key)) {
      e.stopPropagation();
      return;
    }
    if (showGlobalSearchHistoryValue(e.key === "ArrowUp" ? -1 : 1)) e.preventDefault();
    return;
  }

  if (e.key === "Enter" && !e.altKey && (e.ctrlKey || e.metaKey || e.shiftKey)) {
    e.preventDefault();
    insertGlobalSearchInputText("\n");
    return;
  }

  if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    addGlobalSearchHistory(getGlobalSearchQuery());
    return;
  }

  if (e.key === "Escape" && getGlobalSearchQuery()) {
    e.preventDefault();
    clearGlobalSearchInput();
    return;
  }

  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key === "c") {
    e.preventDefault();
    toggleGlobalSearchOption("matchCase");
  } else if (key === "w") {
    e.preventDefault();
    toggleGlobalSearchOption("wholeWord");
  } else if (key === "r") {
    e.preventDefault();
    toggleGlobalSearchOption("regex");
  }
});

globalSearchInput?.addEventListener("focus", () => {
  updateGlobalSearchPlaceholder(true);
});

globalSearchInput?.addEventListener("blur", () => {
  addGlobalSearchHistory(getGlobalSearchQuery());
  globalSearchHistoryIndex = -1;
  globalSearchHistoryDraft = "";
  updateGlobalSearchPlaceholder(false);
});

globalSearchCaseButton?.addEventListener("click", () => {
  toggleGlobalSearchOption("matchCase");
});

globalSearchWordButton?.addEventListener("click", () => {
  toggleGlobalSearchOption("wholeWord");
});

globalSearchRegexButton?.addEventListener("click", () => {
  toggleGlobalSearchOption("regex");
});

globalSearchRefreshButton?.addEventListener("click", async () => {
  await refreshGlobalSearchNow();
  globalSearchInput?.focus();
});

globalSearchClearButton?.addEventListener("click", () => {
  clearGlobalSearchInput();
  globalSearchInput?.focus();
});

globalSearchCollapseButton?.addEventListener("click", () => {
  toggleGlobalSearchCollapseAll();
  globalSearchInput?.focus();
});

document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("side-panel-open") || document.activeElement === globalSearchInput) return;
  const target = e.target instanceof Element ? e.target : document.activeElement;
  if (target?.closest?.(".monaco-editor, .find-widget, .rename-box, .suggest-widget, .quick-input-widget")) return;
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key === "c") {
    e.preventDefault();
    toggleGlobalSearchOption("matchCase", false);
  } else if (key === "w") {
    e.preventDefault();
    toggleGlobalSearchOption("wholeWord", false);
  } else if (key === "r") {
    e.preventDefault();
    toggleGlobalSearchOption("regex", false);
  }
});
updateGlobalSearchToggleState();
resizeGlobalSearchInput();

function showNoteContextMenu(e, noteId) {
  e.preventDefault();
  e.stopPropagation();
  rightClickedNoteId = noteId;
  customContextMenu.style.display = "none";
  tabContextMenu.style.display = "none";
  rightClickedTab = null;

  noteContextMenu.style.display = "block";
  noteContextMenu.style.visibility = "hidden";
  const menuWidth = noteContextMenu.offsetWidth;
  const menuHeight = noteContextMenu.offsetHeight;
  let left = e.pageX;
  let top = e.pageY;
  if (left + menuWidth > window.innerWidth) left = Math.max(0, window.innerWidth - menuWidth);
  if (top + menuHeight > window.innerHeight) top = Math.max(0, window.innerHeight - menuHeight);
  noteContextMenu.style.left = `${left}px`;
  noteContextMenu.style.top = `${top}px`;
  noteContextMenu.style.visibility = "visible";
  noteContextMenu.style.display = "block";
  updateNoteBadgeContextButtonsState();
}

function getNoteMetaById(noteId) {
  return notesIndexCache.find((note) => note.id === noteId) || null;
}

function updateNoteBadgeContextButtonsState() {
  if (!noteContextMenu || !rightClickedNoteId) return;
  ensureNoteBadgeContextButtons();
  const mask = normalizeNoteBadgeMask(getNoteMetaById(rightClickedNoteId)?.badgeMask);
  NOTE_BADGE_EDGES.forEach((edge) => {
    const button = noteContextMenu.querySelector(`.note-badge-edge-button[data-edge="${edge.key}"]`);
    button?.classList.toggle("is-active", Boolean(mask & edge.bit));
  });
}

async function getLiveNoteContent(noteId) {
  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === noteId);
  if (openTab) return openTab.model?.getValue() ?? openTab.content ?? "";
  const note = await window.electronAPI.readNote(noteId);
  return note?.exists ? note.content || "" : null;
}

function getGlobalSearchQuery() {
  return globalSearchInput?.value || "";
}

function isGlobalSearchActive() {
  return Boolean(getGlobalSearchQuery());
}

function setGlobalSearchActive(active) {
  document.body.classList.toggle("global-search-active", Boolean(active));
  updateGlobalSearchActionState();
}

function getGlobalSearchLabel(key, fallback) {
  return i18next.isInitialized ? i18next.t(`sidePanel.${key}`) : fallback;
}

function getGlobalSearchBasePlaceholder() {
  return getGlobalSearchLabel("search", "Search");
}

function updateGlobalSearchPlaceholder(focused = document.activeElement === globalSearchInput) {
  if (!globalSearchInput || !globalSearchPlaceholder) return;
  const base = getGlobalSearchBasePlaceholder();
  globalSearchInput.placeholder = "";
  globalSearchPlaceholder.classList.toggle("hidden", Boolean(globalSearchInput.value));
  globalSearchPlaceholder.textContent = "";

  if (!focused || !globalSearchHistory.length) {
    globalSearchPlaceholder.textContent = base;
    return;
  }

  const symbol = document.createElement("span");
  symbol.className = "global-search-history-symbol";
  symbol.textContent = "\u21c5";

  globalSearchPlaceholder.append(
    document.createTextNode(`${base} (`),
    symbol,
    document.createTextNode(` ${getGlobalSearchLabel("historyHint", "for history")})`),
  );
}

function addGlobalSearchHistory(value) {
  const entry = String(value || "");
  if (!entry) return;
  globalSearchHistory = globalSearchHistory.filter((item) => item !== entry);
  globalSearchHistory.push(entry);
  if (globalSearchHistory.length > GLOBAL_SEARCH_HISTORY_LIMIT) {
    globalSearchHistory = globalSearchHistory.slice(-GLOBAL_SEARCH_HISTORY_LIMIT);
  }
  globalSearchHistoryIndex = -1;
  updateGlobalSearchPlaceholder(document.activeElement === globalSearchInput);
}

function setGlobalSearchInputValue(value) {
  if (!globalSearchInput) return;
  globalSearchInput.value = value;
  globalSearchInput.setSelectionRange(value.length, value.length);
  resizeGlobalSearchInput();
  updateGlobalSearchPlaceholder(document.activeElement === globalSearchInput);
  globalSearchState.dismissedMatches.clear();
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  if (!value) {
    clearGlobalSearchResults();
    return;
  }
  setGlobalSearchActive(true);
  scheduleGlobalSearch();
}

function showGlobalSearchHistoryValue(direction) {
  if (!globalSearchInput || !globalSearchHistory.length) return false;

  if (direction < 0) {
    if (globalSearchHistoryIndex === -1) {
      globalSearchHistoryDraft = globalSearchInput.value;
      globalSearchHistoryIndex = globalSearchHistory.length - 1;
    } else {
      globalSearchHistoryIndex = Math.max(0, globalSearchHistoryIndex - 1);
    }
    setGlobalSearchInputValue(globalSearchHistory[globalSearchHistoryIndex] || "");
    return true;
  }

  if (globalSearchHistoryIndex === -1) return false;
  if (globalSearchHistoryIndex >= globalSearchHistory.length - 1) {
    globalSearchHistoryIndex = -1;
    setGlobalSearchInputValue(globalSearchHistoryDraft);
    globalSearchHistoryDraft = "";
    return true;
  }

  globalSearchHistoryIndex++;
  setGlobalSearchInputValue(globalSearchHistory[globalSearchHistoryIndex] || "");
  return true;
}

function setGlobalSearchButtonLabel(button, labelKey, fallback, shortcut) {
  if (!button) return;
  const label = `${getGlobalSearchLabel(labelKey, fallback)} (${shortcut})`;
  button.title = label;
  button.setAttribute("aria-label", label);
}

function setGlobalSearchActionLabel(button, labelKey, fallback) {
  if (!button) return;
  const label = getGlobalSearchLabel(labelKey, fallback);
  button.title = label;
  button.setAttribute("aria-label", label);
}

function updateGlobalSearchLabels() {
  setGlobalSearchButtonLabel(globalSearchCaseButton, "matchCase", "Match Case", "Alt+C");
  setGlobalSearchButtonLabel(globalSearchWordButton, "matchWholeWord", "Match Whole Word", "Alt+W");
  setGlobalSearchButtonLabel(globalSearchRegexButton, "useRegex", "Use Regular Expression", "Alt+R");
  setGlobalSearchActionLabel(globalSearchRefreshButton, "refresh", "Refresh");
  setGlobalSearchActionLabel(globalSearchClearButton, "clearSearchResults", "Clear Search Results");
  setGlobalSearchActionLabel(
    globalSearchCollapseButton,
    globalSearchState.allCollapsed ? "expandAll" : "collapseAll",
    globalSearchState.allCollapsed ? "Expand All" : "Collapse All",
  );
}

function hasGlobalSearchResults() {
  return Boolean(isGlobalSearchActive() && globalSearchResultsList?.querySelector(".global-search-file"));
}

function updateGlobalSearchActionState() {
  updateGlobalSearchLabels();
  if (globalSearchRefreshButton) globalSearchRefreshButton.disabled = !isGlobalSearchActive();
  if (globalSearchClearButton)
    globalSearchClearButton.disabled = !isGlobalSearchActive() && !globalSearchState.totalMatches;
  if (globalSearchCollapseButton) {
    globalSearchCollapseButton.disabled = !hasGlobalSearchResults();
    globalSearchCollapseButton.classList.toggle("codicon-collapse-all", !globalSearchState.allCollapsed);
    globalSearchCollapseButton.classList.toggle("codicon-expand-all", globalSearchState.allCollapsed);
    globalSearchCollapseButton.setAttribute("aria-pressed", String(globalSearchState.allCollapsed));
  }
}

function updateGlobalSearchToggleState() {
  updateGlobalSearchLabels();
  globalSearchCaseButton?.classList.toggle("active", globalSearchState.matchCase);
  globalSearchCaseButton?.setAttribute("aria-pressed", String(globalSearchState.matchCase));
  globalSearchWordButton?.classList.toggle("active", globalSearchState.wholeWord);
  globalSearchWordButton?.setAttribute("aria-pressed", String(globalSearchState.wholeWord));
  globalSearchRegexButton?.classList.toggle("active", globalSearchState.regex);
  globalSearchRegexButton?.setAttribute("aria-pressed", String(globalSearchState.regex));
  updateGlobalSearchActionState();
}

function toggleGlobalSearchOption(option, focusInput = true) {
  globalSearchState[option] = !globalSearchState[option];
  globalSearchState.dismissedMatches.clear();
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  updateGlobalSearchToggleState();
  if (isGlobalSearchActive()) scheduleGlobalSearch();
  if (focusInput) globalSearchInput?.focus();
}

function validateGlobalSearchRegex(query) {
  if (!globalSearchState.regex || !query) return null;
  try {
    new RegExp(query, "u");
    return null;
  } catch (error) {
    return error?.message || "Invalid regular expression";
  }
}

function scheduleGlobalSearch() {
  if (globalSearchTimer) clearTimeout(globalSearchTimer);
  globalSearchTimer = setTimeout(() => {
    globalSearchTimer = null;
    runGlobalSearch();
  }, GLOBAL_SEARCH_DEBOUNCE_MS);
}

function scheduleGlobalSearchAfterTabSetChange() {
  if (!isGlobalSearchActive()) return;
  scheduleGlobalSearch();
}

function getGlobalSearchResultsSignature(results, totalMatches) {
  return JSON.stringify({
    totalMatches,
    limitHit: globalSearchState.limitHit,
    results: results.map((result) => ({
      targetId: result.targetId,
      type: result.type,
      title: result.title,
      path: result.path,
      fullPath: result.fullPath,
      matches: result.matches.map((match) => ({
        id: match.id,
        lineNumber: match.lineNumber,
        startLineNumber: match.range.startLineNumber,
        startColumn: match.range.startColumn,
        endLineNumber: match.range.endLineNumber,
        endColumn: match.range.endColumn,
        before: match.preview.fullBefore,
        inside: match.preview.inside,
        after: match.preview.after,
        fullLine: match.preview.fullLine,
      })),
    })),
  });
}

function updateGlobalSearchResultHeaderLabels() {
  if (!globalSearchResults) return;
  const summary = globalSearchResults.querySelector(".global-search-summary");
  if (summary) {
    summary.textContent = i18next.isInitialized
      ? i18next.t("sidePanel.searchSummary", {
          count: globalSearchState.totalMatches,
          items: globalSearchState.totalItems,
        })
      : `${globalSearchState.totalMatches} results in ${globalSearchState.totalItems} items`;
  }

  const warning = globalSearchResults.querySelector(".global-search-warning");
  if (warning) {
    const icon = warning.querySelector(".global-search-warning-icon");
    warning.textContent = "";
    if (icon) warning.appendChild(icon);
    else {
      const nextIcon = document.createElement("span");
      nextIcon.className = "global-search-warning-icon";
      nextIcon.setAttribute("aria-hidden", "true");
      warning.appendChild(nextIcon);
    }
    warning.appendChild(
      document.createTextNode(
        getGlobalSearchLabel(
          "searchLimitWarning",
          "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.",
        ),
      ),
    );
  }

  const message = globalSearchResultsList?.querySelector(".global-search-message");
  if (message) {
    if (!getGlobalSearchQuery()) return;
    if (!globalSearchState.totalMatches) message.textContent = getGlobalSearchLabel("noResults", "No results found");
  }
}

async function refreshNotesListNow() {
  if (globalSearchTimer) {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = null;
  }
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
  noteContentCache.clear();
  await renderNotesList({ scheduleSearch: false });
  updateGlobalSearchActionState();
}

async function refreshGlobalSearchNow() {
  if (globalSearchTimer) {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = null;
  }
  globalSearchState.dismissedMatches.clear();
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  if (isGlobalSearchActive()) await runGlobalSearch();
  else updateGlobalSearchActionState();
}

function syncGlobalSearchCollapseStateFromDom() {
  if (!globalSearchResultsList || !hasGlobalSearchResults()) {
    globalSearchState.allCollapsed = false;
  } else {
    const files = Array.from(globalSearchResultsList.querySelectorAll(".global-search-file"));
    globalSearchState.allCollapsed = files.length > 0 && files.every((file) => file.classList.contains("collapsed"));
  }
  updateGlobalSearchActionState();
}

function isGlobalSearchFileSticky(fileRow) {
  if (!globalSearchResultsList || !fileRow) return false;
  const rowTop = fileRow.getBoundingClientRect().top;
  const listTop = globalSearchResultsList.getBoundingClientRect().top;
  return Math.abs(rowTop - listTop) <= 1;
}

function getGlobalSearchFlowOffsetTop(fileRow) {
  if (!fileRow || !globalSearchResultsList) return null;
  let top = 0;
  for (let node = globalSearchResultsList.firstElementChild; node && node !== fileRow; node = node.nextElementSibling) {
    top += node.offsetHeight;
  }
  return top;
}

function toggleGlobalSearchFileCollapsed(fileRow, targetId) {
  if (!fileRow || !targetId) return;
  const shouldCollapse = !fileRow.classList.contains("collapsed");
  const wasSticky = isGlobalSearchFileSticky(fileRow);
  const targetScrollTop = wasSticky ? getGlobalSearchFlowOffsetTop(fileRow) : null;
  fileRow.classList.toggle("collapsed", shouldCollapse);
  if (shouldCollapse) globalSearchState.collapsedTargetIds.add(targetId);
  else globalSearchState.collapsedTargetIds.delete(targetId);
  syncGlobalSearchCollapseStateFromDom();

  if (targetScrollTop !== null && globalSearchResultsList) {
    requestAnimationFrame(() => {
      globalSearchResultsList.scrollTop = targetScrollTop;
    });
  }
}

function setGlobalSearchCollapseAll(collapsed) {
  if (!globalSearchResultsList || !hasGlobalSearchResults()) return;
  globalSearchState.allCollapsed = Boolean(collapsed);
  if (globalSearchState.allCollapsed) {
    globalSearchState.results.forEach((result) => globalSearchState.collapsedTargetIds.add(result.targetId));
  } else {
    globalSearchState.collapsedTargetIds.clear();
  }
  globalSearchResultsList.querySelectorAll(".global-search-file").forEach((fileRow) => {
    fileRow.classList.toggle("collapsed", globalSearchState.allCollapsed);
  });
  updateGlobalSearchActionState();
}

function toggleGlobalSearchCollapseAll() {
  setGlobalSearchCollapseAll(!globalSearchState.allCollapsed);
}

function clearGlobalSearchResults() {
  globalSearchSeq++;
  resetGlobalSearchPreviewObserver();
  globalSearchState.results = [];
  globalSearchState.totalMatches = 0;
  globalSearchState.totalItems = 0;
  globalSearchState.limitHit = false;
  globalSearchResultsSignature = "";
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  globalSearchState.dismissedMatches.clear();
  globalSearchInput?.classList.remove("invalid");
  globalSearchResults?.querySelector(".global-search-summary")?.remove();
  globalSearchResults?.querySelector(".global-search-warning")?.remove();
  if (globalSearchResultsList) globalSearchResultsList.innerHTML = "";
  setGlobalSearchActive(false);
  updateGlobalSearchActionState();
}

function clearGlobalSearchInput() {
  if (globalSearchTimer) {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = null;
  }
  if (globalSearchInput) globalSearchInput.value = "";
  resizeGlobalSearchInput();
  globalSearchHistoryIndex = -1;
  globalSearchHistoryDraft = "";
  updateGlobalSearchPlaceholder(document.activeElement === globalSearchInput);
  clearGlobalSearchResults();
}

function normalizeSearchPreviewText(text) {
  return String(text || "").replace(/\s+/g, " ");
}

function escapeSearchPreview(text, maxLength = GLOBAL_SEARCH_PREVIEW_MAX) {
  const value = normalizeSearchPreviewText(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createGlobalSearchPreview(model, match) {
  const range = match.range;
  const startLine = model.getLineContent(range.startLineNumber);
  const endLine = model.getLineContent(range.endLineNumber);
  const beforeFull = startLine.slice(0, range.startColumn - 1);
  const inside = model.getValueInRange(range);
  const after = endLine.slice(range.endColumn - 1);
  const fullLine = range.startLineNumber === range.endLineNumber ? startLine : `${beforeFull}${inside}${after}`;
  return {
    fullBefore: normalizeSearchPreviewText(beforeFull).slice(-GLOBAL_SEARCH_PREVIEW_MAX),
    inside: escapeSearchPreview(inside || match.matches?.[0] || "", GLOBAL_SEARCH_PREVIEW_MAX),
    after: escapeSearchPreview(after, GLOBAL_SEARCH_PREVIEW_MAX),
    fullLine,
  };
}

function getGlobalSearchMeasureContext() {
  if (!globalSearchMeasureContext) {
    const canvas = document.createElement("canvas");
    globalSearchMeasureContext = canvas.getContext("2d");
  }
  return globalSearchMeasureContext;
}

function getGlobalSearchPreviewFont(previewElement) {
  const style = window.getComputedStyle(previewElement);
  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function measureGlobalSearchText(text, font) {
  const context = getGlobalSearchMeasureContext();
  if (!context) return String(text || "").length * 8;
  context.font = font;
  return context.measureText(String(text || "")).width;
}

function fitGlobalSearchTextEnd(text, maxWidth, font, prefix = "") {
  const value = String(text || "");
  if (!value) return "";
  if (measureGlobalSearchText(value, font) <= maxWidth) return value;

  const prefixWidth = measureGlobalSearchText(prefix, font);
  const targetWidth = Math.max(0, maxWidth - prefixWidth);
  let low = 0;
  let high = value.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const suffix = value.slice(value.length - mid);
    if (measureGlobalSearchText(suffix, font) <= targetWidth) low = mid;
    else high = mid - 1;
  }

  return `${prefix}${value.slice(value.length - low)}`;
}

function fitGlobalSearchTextStart(text, maxWidth, font, suffix = "") {
  const value = String(text || "");
  if (!value) return "";
  if (measureGlobalSearchText(value, font) <= maxWidth) return value;

  const suffixWidth = measureGlobalSearchText(suffix, font);
  const targetWidth = Math.max(0, maxWidth - suffixWidth);
  let low = 0;
  let high = value.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const prefix = value.slice(0, mid);
    if (measureGlobalSearchText(prefix, font) <= targetWidth) low = mid;
    else high = mid - 1;
  }

  return `${value.slice(0, low)}${suffix}`;
}

function applyGlobalSearchPreviewDisplay(row, display) {
  if (!row || !display) return;
  const before = row.querySelector?.(".global-search-before");
  const hit = row.querySelector?.(".global-search-hit");
  const after = row.querySelector?.(".global-search-after");
  if (!before || !hit || !after) return;
  if (before.textContent !== display.before) before.textContent = display.before;
  if (hit.textContent !== display.hit) hit.textContent = display.hit;
  if (after.textContent !== display.after) after.textContent = display.after;
  row.classList.add("preview-ready");
}

function updateGlobalSearchPreviewElement(row) {
  const preview = row?.querySelector?.(".global-search-preview");
  const before = row?.querySelector?.(".global-search-before");
  const hit = row?.querySelector?.(".global-search-hit");
  const after = row?.querySelector?.(".global-search-after");
  const matchId = row?.dataset?.matchId;
  if (!preview || !before || !hit || !after || !matchId) return false;

  const match =
    row.globalSearchMatch ||
    globalSearchState.results.flatMap((result) => result.matches).find((item) => item.id === matchId);
  if (!match) return false;

  const width = preview.clientWidth;
  if (!width) return false;
  const font = getGlobalSearchPreviewFont(preview);
  const beforeText = match.preview.fullBefore;
  const hitText = match.preview.inside;
  const afterText = match.preview.after;
  const beforeWidth = measureGlobalSearchText(beforeText, font);
  const hitWidth = measureGlobalSearchText(hitText, font);
  const ellipsis = "...";

  const beforeLimit = width * GLOBAL_SEARCH_BEFORE_MAX_RATIO;
  const minMatchWidth = Math.min(hitWidth, width * GLOBAL_SEARCH_MATCH_MIN_RATIO);
  const shouldShiftWindow = beforeWidth + minMatchWidth > width;
  const beforeTargetWidth = shouldShiftWindow ? beforeLimit : Math.min(beforeWidth, width);
  const beforeDisplay = fitGlobalSearchTextEnd(beforeText, beforeTargetWidth, font, shouldShiftWindow ? ellipsis : "");
  const remainingWidth = Math.max(0, width - measureGlobalSearchText(beforeDisplay, font));
  const hitDisplay = fitGlobalSearchTextStart(hitText, remainingWidth, font, ellipsis);
  const hitComplete = hitDisplay === hitText;
  const afterDisplay = hitComplete ? afterText : "";
  const display = {
    width: Math.round(width),
    before: beforeDisplay,
    hit: hitDisplay,
    after: afterDisplay,
  };

  applyGlobalSearchPreviewDisplay(row, display);
  globalSearchPreviewDisplayCache.set(matchId, display);
  globalSearchIdlePreviewRows.delete(row);
  return true;
}

function updateGlobalSearchPreviewElements() {
  if (!globalSearchResultsList) return;
  if (globalSearchVisiblePreviewRows.size) {
    globalSearchVisiblePreviewRows.forEach((row) => updateGlobalSearchPreviewElement(row));
    return;
  }
  globalSearchResultsList
    .querySelectorAll(".global-search-match")
    .forEach((row) => updateGlobalSearchPreviewElement(row));
}

function scheduleGlobalSearchPreviewUpdate() {
  if (globalSearchPreviewFrame !== null) return;
  globalSearchPreviewFrame = requestAnimationFrame(() => {
    globalSearchPreviewFrame = null;
    updateGlobalSearchPreviewElements();
  });
}

function requestGlobalSearchIdleCallback(callback) {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout: 600 });
  }
  return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 32);
}

function cancelGlobalSearchIdleCallback(handle) {
  if (handle === null) return;
  if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

function isGlobalSearchRowInCollapsedGroup(row) {
  const group = row?.closest?.(".global-search-match-group");
  return Boolean(group?.previousElementSibling?.classList?.contains("collapsed"));
}

function processGlobalSearchIdlePreviewRows(deadline) {
  globalSearchPreviewIdleHandle = null;
  if (!globalSearchResultsList || !isGlobalSearchActive()) {
    globalSearchIdlePreviewRows.clear();
    return;
  }

  let processed = 0;
  while (globalSearchIdlePreviewRows.size) {
    if (
      processed >= GLOBAL_SEARCH_IDLE_PREVIEW_BATCH ||
      (processed > 0 && !deadline.didTimeout && deadline.timeRemaining() < 4)
    ) {
      break;
    }

    const row = globalSearchIdlePreviewRows.values().next().value;
    globalSearchIdlePreviewRows.delete(row);
    if (!row?.isConnected || row.classList.contains("preview-ready") || isGlobalSearchRowInCollapsedGroup(row))
      continue;
    updateGlobalSearchPreviewElement(row);
    processed++;
  }

  if (globalSearchIdlePreviewRows.size) scheduleGlobalSearchIdlePreviewUpdate();
}

function scheduleGlobalSearchIdlePreviewUpdate() {
  if (globalSearchPreviewIdleHandle !== null || !globalSearchIdlePreviewRows.size) return;
  globalSearchPreviewIdleHandle = requestGlobalSearchIdleCallback(processGlobalSearchIdlePreviewRows);
}

function queueGlobalSearchIdlePreviewRow(row) {
  if (!row || row.classList.contains("preview-ready")) return;
  globalSearchIdlePreviewRows.add(row);
  scheduleGlobalSearchIdlePreviewUpdate();
}

function updateGlobalSearchFilePathVisibility() {
  if (!globalSearchResultsList) return;
  globalSearchResultsList.querySelectorAll(".global-search-file.has-path").forEach((row) => {
    const label = row.querySelector(".global-search-file-label");
    const title = row.querySelector(".global-search-file-title");
    const path = row.querySelector(".global-search-file-path");
    if (!label || !title || !path?.textContent) {
      row.classList.remove("show-path");
      return;
    }
    row.classList.remove("show-path");
    const available = label.clientWidth;
    const titleWidth = title.scrollWidth;
    row.classList.toggle("show-path", available - titleWidth >= 36);
  });
}

function scheduleGlobalSearchFilePathUpdate() {
  if (globalSearchFilePathFrame !== null) return;
  globalSearchFilePathFrame = requestAnimationFrame(() => {
    globalSearchFilePathFrame = null;
    updateGlobalSearchFilePathVisibility();
  });
}

function resetGlobalSearchPreviewObserver() {
  if (globalSearchPreviewFrame !== null) {
    cancelAnimationFrame(globalSearchPreviewFrame);
    globalSearchPreviewFrame = null;
  }
  if (globalSearchPreviewIdleHandle !== null) {
    cancelGlobalSearchIdleCallback(globalSearchPreviewIdleHandle);
    globalSearchPreviewIdleHandle = null;
  }
  if (globalSearchFilePathFrame !== null) {
    cancelAnimationFrame(globalSearchFilePathFrame);
    globalSearchFilePathFrame = null;
  }
  if (globalSearchPreviewObserver) {
    globalSearchPreviewObserver.disconnect();
    globalSearchPreviewObserver = null;
  }
  globalSearchVisiblePreviewRows.clear();
  globalSearchIdlePreviewRows.clear();
}

function getGlobalSearchPreviewObserver() {
  if (!("IntersectionObserver" in window) || !globalSearchResultsList) return null;
  if (!globalSearchPreviewObserver) {
    globalSearchPreviewObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target;
          if (!entry.isIntersecting) {
            globalSearchVisiblePreviewRows.delete(row);
            continue;
          }
          globalSearchVisiblePreviewRows.add(row);
          updateGlobalSearchPreviewElement(row);
        }
      },
      {
        root: globalSearchResultsList,
        rootMargin: "220px 0px",
        threshold: 0,
      },
    );
  }
  return globalSearchPreviewObserver;
}

function observeGlobalSearchPreviewRow(row) {
  queueGlobalSearchIdlePreviewRow(row);
  const observer = getGlobalSearchPreviewObserver();
  if (!observer) {
    globalSearchVisiblePreviewRows.add(row);
    updateGlobalSearchPreviewElement(row);
    return;
  }
  observer.observe(row);
}

function getOpenTabSearchId(tab) {
  if (!tab._searchTargetId) tab._searchTargetId = `tab:${++openTabSearchIdSeq}`;
  return tab._searchTargetId;
}

function getSearchResultPathDisplay(fullPath) {
  const value = String(fullPath || "");
  if (!value) return "";
  const index = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  return index > 0 ? value.slice(0, index) : value;
}

function getGlobalSearchMatchId(targetId, range, query) {
  return `${targetId}:${range.startLineNumber}:${range.startColumn}:${range.endLineNumber}:${range.endColumn}:${query}`;
}

function createOpenTabSearchTarget(tab, order) {
  const title = truncateNoteTitle(tab.name || getNoteTitleFromContent(tab.model?.getValue() ?? tab.content ?? ""));
  return {
    type: tab.isNote ? "note" : "tab",
    targetId: tab.isNote && tab.noteId ? `note:${tab.noteId}` : getOpenTabSearchId(tab),
    noteId: tab.isNote ? tab.noteId : null,
    tabId: tab.isNote ? null : getOpenTabSearchId(tab),
    tab,
    title,
    path: tab.isNote ? "" : getSearchResultPathDisplay(tab.path),
    fullPath: tab.isNote ? title : tab.path || title,
    order,
  };
}

function createGlobalSearchTarget(note, order) {
  return {
    type: "note",
    targetId: `note:${note.id}`,
    noteId: note.id,
    note,
    title: truncateNoteTitle(note.title || getNoteTitleFromContent("")),
    path: "",
    fullPath: truncateNoteTitle(note.title || getNoteTitleFromContent("")),
    order,
  };
}

function createSearchTargets(notes) {
  const targets = [];
  const openNoteIds = new Set();

  tabData.forEach((tab, index) => {
    if (!tab) return;
    if (tab.isNotePreview) return;
    if (tab.isNote && tab.noteId) openNoteIds.add(tab.noteId);
    targets.push(createOpenTabSearchTarget(tab, index));
  });

  notes.forEach((note, index) => {
    if (!note?.id || openNoteIds.has(note.id)) return;
    targets.push(createGlobalSearchTarget(note, tabData.length + index));
  });

  return targets;
}

async function getSearchableTargetContent(target) {
  if (target.type === "tab") {
    if (!tabData.includes(target.tab)) return null;
    return target.tab.model?.getValue() ?? target.tab.content ?? "";
  }
  if (target.tab && tabData.includes(target.tab)) {
    return target.tab.model?.getValue() ?? target.tab.content ?? "";
  }
  return getSearchableNoteContent(target.note);
}

function searchTargetContent(target, content, query, maxMatches = GLOBAL_SEARCH_MAX_MATCHES) {
  const existingModel = target.type === "tab" || target.tab ? target.tab?.model : null;
  const model = existingModel || monaco.editor.createModel(content || "", "monapad");
  try {
    const askMax = Math.max(1, maxMatches + 1);
    const matches = model.findMatches(
      query,
      model.getFullModelRange(),
      globalSearchState.regex,
      globalSearchState.matchCase,
      globalSearchState.wholeWord ? GLOBAL_SEARCH_WORD_SEPARATORS : null,
      false,
      askMax,
    );

    const limitHit = matches.length >= askMax;
    const visibleMatches = limitHit ? matches.slice(0, maxMatches) : matches;

    return {
      limitHit,
      matches: visibleMatches.map((match) => {
        const range = match.range;
        return {
          id: getGlobalSearchMatchId(target.targetId, range, query),
          targetId: target.targetId,
          type: target.type,
          noteId: target.noteId,
          tabId: target.tabId,
          lineNumber: range.startLineNumber,
          range,
          preview: createGlobalSearchPreview(model, match),
        };
      }),
    };
  } finally {
    if (!existingModel) model.dispose();
  }
}

async function getSearchableNoteContent(note) {
  const openTab = tabData.find((tab) => tab.isNote && tab.noteId === note.id);
  if (openTab) {
    const content = openTab.model?.getValue() ?? openTab.content ?? "";
    noteContentCache.set(note.id, { updatedAt: openTab.noteUpdatedAt || note.updatedAt || 0, content });
    return content;
  }

  const cached = noteContentCache.get(note.id);
  if (cached && cached.updatedAt === (note.updatedAt || 0)) return cached.content;

  const fullNote = await window.electronAPI.readNote(note.id);
  if (!fullNote?.exists) return null;

  const content = fullNote.content || "";
  noteContentCache.set(note.id, { updatedAt: fullNote.meta?.updatedAt || note.updatedAt || 0, content });
  return content;
}

async function runGlobalSearch() {
  const query = getGlobalSearchQuery();
  globalSearchState.query = query;
  updateGlobalSearchToggleState();

  if (!query) {
    clearGlobalSearchResults();
    return;
  }

  setGlobalSearchActive(true);
  const seq = ++globalSearchSeq;
  const regexError = validateGlobalSearchRegex(query);
  globalSearchInput?.classList.toggle("invalid", Boolean(regexError));
  if (regexError) {
    renderGlobalSearchMessage(regexError);
    return;
  }

  if (!globalSearchResultsSignature && !globalSearchState.totalMatches)
    renderGlobalSearchMessage(getGlobalSearchLabel("searching", "Searching..."));

  try {
    const notes = sortNotesForPanel(
      Array.isArray(notesIndexCache) && notesIndexCache.length ? notesIndexCache : await window.electronAPI.listNotes(),
    );
    const targets = createSearchTargets(notes);
    const results = [];
    let totalMatches = 0;
    let limitHit = false;

    for (const target of targets) {
      if (target.type === "note" && target.note?.contentBytes === 0) continue;
      if (totalMatches >= GLOBAL_SEARCH_MAX_MATCHES) {
        limitHit = true;
        break;
      }

      const content = await getSearchableTargetContent(target);
      if (seq !== globalSearchSeq || content === null) return;

      const remaining = GLOBAL_SEARCH_MAX_MATCHES - totalMatches;
      const searchResult = searchTargetContent(target, content, query, remaining);
      let matches = searchResult.matches.filter((match) => !globalSearchState.dismissedMatches.has(match.id));
      if (searchResult.limitHit || matches.length > remaining) {
        limitHit = true;
        matches = matches.slice(0, remaining);
      }
      if (!matches.length) {
        if (limitHit) break;
        continue;
      }

      totalMatches += matches.length;
      results.push({
        targetId: target.targetId,
        type: target.type,
        noteId: target.noteId,
        tabId: target.tabId,
        title:
          target.type === "note" ? truncateNoteTitle(target.title || getNoteTitleFromContent(content)) : target.title,
        path: target.path,
        fullPath: target.fullPath,
        order: target.order,
        matches,
      });

      if (limitHit || totalMatches >= GLOBAL_SEARCH_MAX_MATCHES) {
        limitHit = true;
        break;
      }
    }

    if (seq !== globalSearchSeq) return;
    results.sort((a, b) => a.order - b.order);

    globalSearchState.limitHit = limitHit;
    const nextSignature = getGlobalSearchResultsSignature(results, totalMatches);
    if (nextSignature === globalSearchResultsSignature) {
      updateGlobalSearchActionState();
      return;
    }

    globalSearchState.results = results;
    const resultTargetIds = new Set(results.map((result) => result.targetId));
    globalSearchState.collapsedTargetIds = new Set(
      [...globalSearchState.collapsedTargetIds].filter((targetId) => resultTargetIds.has(targetId)),
    );
    globalSearchState.totalMatches = totalMatches;
    globalSearchState.totalItems = results.length;
    globalSearchState.limitHit = limitHit;
    globalSearchResultsSignature = nextSignature;
    renderGlobalSearchResults();
  } catch (error) {
    if (seq !== globalSearchSeq) return;
    renderGlobalSearchMessage(error?.message || getGlobalSearchLabel("searchFailed", "Search failed"));
  }
}

function renderGlobalSearchMessage(message) {
  if (!globalSearchResults || !globalSearchResultsList) return;
  resetGlobalSearchPreviewObserver();
  globalSearchResults.querySelector(".global-search-summary")?.remove();
  globalSearchResults.querySelector(".global-search-warning")?.remove();
  globalSearchResultsList.innerHTML = "";
  const item = document.createElement("div");
  item.className = "global-search-message";
  item.textContent = message;
  globalSearchResultsList.appendChild(item);
  updateGlobalSearchActionState();
}

function renderGlobalSearchResults() {
  if (!globalSearchResults || !globalSearchResultsList) return;
  resetGlobalSearchPreviewObserver();
  globalSearchResults.querySelector(".global-search-summary")?.remove();
  globalSearchResults.querySelector(".global-search-warning")?.remove();
  globalSearchResultsList.innerHTML = "";

  if (!globalSearchState.totalMatches) {
    renderGlobalSearchMessage(getGlobalSearchLabel("noResults", "No results found"));
    return;
  }

  const summary = document.createElement("div");
  summary.className = "global-search-summary";
  summary.textContent = i18next.isInitialized
    ? i18next.t("sidePanel.searchSummary", {
        count: globalSearchState.totalMatches,
        items: globalSearchState.totalItems,
      })
    : `${globalSearchState.totalMatches} results in ${globalSearchState.totalItems} items`;
  globalSearchResults.insertBefore(summary, globalSearchResultsList);

  if (globalSearchState.limitHit) {
    const warning = document.createElement("div");
    warning.className = "global-search-warning";
    const icon = document.createElement("span");
    icon.className = "global-search-warning-icon";
    icon.setAttribute("aria-hidden", "true");
    warning.append(icon);
    globalSearchResults.insertBefore(warning, globalSearchResultsList);
  }
  updateGlobalSearchResultHeaderLabels();

  for (const result of globalSearchState.results) {
    const fileRow = document.createElement("div");
    const isCollapsed = globalSearchState.allCollapsed || globalSearchState.collapsedTargetIds.has(result.targetId);
    fileRow.className = `global-search-file ${result.type}-target${isCollapsed ? " collapsed" : ""}`;
    fileRow.classList.toggle("has-path", Boolean(result.path));
    fileRow.dataset.targetId = result.targetId;
    if (result.noteId) fileRow.dataset.noteId = result.noteId;

    const twistie = document.createElement("span");
    twistie.className = "global-search-twistie codicon codicon-chevron-down";

    const label = document.createElement("span");
    label.className = "global-search-file-label";
    label.title = result.fullPath || result.title;

    const title = document.createElement("span");
    title.className = "global-search-file-title";
    title.textContent = result.title;

    const path = document.createElement("span");
    path.className = "global-search-file-path";
    path.textContent = result.path || "";
    label.append(title, path);

    const count = document.createElement("span");
    count.className = "global-search-count";
    count.textContent = result.matches.length;

    const dismiss = document.createElement("button");
    dismiss.className = "global-search-file-dismiss codicon codicon-close";
    dismiss.type = "button";
    dismiss.title = getGlobalSearchLabel("dismiss", "Dismiss");
    dismiss.setAttribute("aria-label", getGlobalSearchLabel("dismiss", "Dismiss"));
    dismiss.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissGlobalSearchFile(result.targetId);
    });

    const matchGroup = document.createElement("div");
    matchGroup.className = "global-search-match-group";
    const rowsToObserve = [];

    fileRow.append(twistie, label, count, dismiss);
    fileRow.addEventListener("click", () => {
      toggleGlobalSearchFileCollapsed(fileRow, result.targetId);
    });

    for (const match of result.matches) {
      const matchRow = createGlobalSearchMatchElement(match);
      matchGroup.appendChild(matchRow);
      rowsToObserve.push(matchRow);
    }

    globalSearchResultsList.append(fileRow, matchGroup);
    rowsToObserve.forEach((row) => observeGlobalSearchPreviewRow(row));
  }
  scheduleGlobalSearchFilePathUpdate();
  updateGlobalSearchActionState();
}

function createGlobalSearchMatchElement(match) {
  const row = document.createElement("div");
  row.className = "global-search-match";
  row.dataset.targetId = match.targetId;
  if (match.noteId) row.dataset.noteId = match.noteId;
  row.dataset.matchId = match.id;
  row.globalSearchMatch = match;
  row.title = `${match.lineNumber}: ${escapeSearchPreview(match.preview.fullLine, GLOBAL_SEARCH_HOVER_MAX)}`;
  const cachedPreview = globalSearchPreviewDisplayCache.get(match.id);
  if (cachedPreview) row.classList.add("preview-ready");

  const preview = document.createElement("span");
  preview.className = "global-search-preview";

  const before = document.createElement("span");
  before.className = "global-search-before";
  before.textContent = match.preview.fullBefore;
  const hit = document.createElement("span");
  hit.className = "global-search-hit";
  hit.textContent = match.preview.inside;
  const after = document.createElement("span");
  after.className = "global-search-after";
  after.textContent = cachedPreview?.after ?? match.preview.after;
  if (cachedPreview) {
    before.textContent = cachedPreview.before;
    hit.textContent = cachedPreview.hit;
  }
  preview.append(before, hit, after);

  const dismiss = document.createElement("button");
  dismiss.className = "global-search-dismiss codicon codicon-close";
  dismiss.type = "button";
  dismiss.title = getGlobalSearchLabel("dismiss", "Dismiss");
  dismiss.setAttribute("aria-label", getGlobalSearchLabel("dismiss", "Dismiss"));
  dismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissGlobalSearchMatch(match.id);
  });

  row.append(preview, dismiss);
  row.addEventListener("click", async () => {
    if (suppressGlobalSearchMatchClick) return;
    await openGlobalSearchMatch(match, { preview: true });
  });
  row.addEventListener("dblclick", async () => {
    if (suppressGlobalSearchMatchClick) return;
    await openGlobalSearchMatch(match, { preview: false });
  });
  row.addEventListener("auxclick", async (e) => {
    if (e.button !== 1 || suppressGlobalSearchMatchClick) return;
    e.preventDefault();
    await openGlobalSearchMatch(match, { preview: false });
  });
  row.addEventListener("mousedown", (e) => beginGlobalSearchMatchDrag(e, row, match));
  return row;
}

function dismissGlobalSearchMatch(matchId) {
  globalSearchState.dismissedMatches.add(matchId);
  for (const result of globalSearchState.results) {
    result.matches = result.matches.filter((match) => match.id !== matchId);
  }
  globalSearchState.results = globalSearchState.results.filter((result) => result.matches.length);
  globalSearchState.totalMatches = globalSearchState.results.reduce(
    (total, result) => total + result.matches.length,
    0,
  );
  globalSearchState.totalItems = globalSearchState.results.length;
  globalSearchResultsSignature = getGlobalSearchResultsSignature(
    globalSearchState.results,
    globalSearchState.totalMatches,
  );
  renderGlobalSearchResults();
}

function dismissGlobalSearchFile(targetId) {
  const result = globalSearchState.results.find((item) => item.targetId === targetId);
  if (!result) return;
  result.matches.forEach((match) => globalSearchState.dismissedMatches.add(match.id));
  globalSearchState.results = globalSearchState.results.filter((item) => item.targetId !== targetId);
  globalSearchState.totalMatches = globalSearchState.results.reduce((total, item) => total + item.matches.length, 0);
  globalSearchState.totalItems = globalSearchState.results.length;
  globalSearchResultsSignature = getGlobalSearchResultsSignature(
    globalSearchState.results,
    globalSearchState.totalMatches,
  );
  renderGlobalSearchResults();
}

async function openGlobalSearchMatch(match, options = {}) {
  const tab =
    match.type === "tab"
      ? tabData.find((item) => item._searchTargetId === match.tabId)
      : await openNoteById(match.noteId, { preview: options.preview !== false });
  if (!tab || !monacoEditor) return;
  if (match.type === "tab") switchTab(tab);

  revealSearchRange(createRangeFromGlobalSearchMatch(match));
}

function createRangeFromGlobalSearchMatch(match) {
  if (!match?.range) return null;
  return new monaco.Range(
    match.range.startLineNumber,
    match.range.startColumn,
    match.range.endLineNumber,
    match.range.endColumn,
  );
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
    noteTitle: tab.noteTitle,
    noteCreatedAt: tab.noteCreatedAt,
    noteUpdatedAt: tab.noteUpdatedAt,
    noteBadgeMask: tab.noteBadgeMask,
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
    openTab.noteTitle = null;
    openTab.noteDirty = false;
    openTab.path = null;
    openTab.draftId = createAutosaveId();
    openTab.name = `${i18next.t("file.untitled")}.txt`;
    openTab.element.classList.remove("note", "preview");
    const nameSpan = openTab.element.querySelector(".name");
    if (nameSpan) {
      nameSpan.textContent = openTab.name;
      nameSpan.title = openTab.name;
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
      noteTitle: truncateNoteTitle(openTab.noteTitle || openTab.name),
      noteCreatedAt: openTab.noteCreatedAt,
      noteUpdatedAt: openTab.noteUpdatedAt,
      noteBadgeMask: openTab.noteBadgeMask,
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
    noteTitle: title,
    noteCreatedAt: note.meta?.createdAt,
    noteUpdatedAt: note.meta?.updatedAt,
    noteBadgeMask: normalizeNoteBadgeMask(note.meta?.badgeMask),
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
      badgeMask: payload?.noteBadgeMask,
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
      title: truncateNoteTitle(payload.noteTitle || payload.name),
      createdAt: payload.noteCreatedAt,
      updatedAt: payload.noteUpdatedAt,
      badgeMask: payload.noteBadgeMask,
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

function beginNoteListDrag(e, item) {
  if (e.button === 1) {
    e.preventDefault();
    return;
  }
  if (e.button !== 0 || e.target.closest(".note-pin-button")) return;
  startSidePanelNoteDragFromItem(item, e);
}

function startSidePanelNoteDragFromItem(item, e, options = {}) {
  noteDragState = {
    item,
    noteId: item.dataset.noteId,
    startY: e.clientY,
    currentY: 0,
    dragIndex: [...notesList.querySelectorAll(".note-list-item")].indexOf(item),
    originalOrder: [...notesList.querySelectorAll(".note-list-item")].map((node) => node.dataset.noteId),
    dragging: false,
    mode: "panel",
    payloadPromise: getNoteTabPayload(item.dataset.noteId),
    externalStarted: false,
    transferringToTabDrag: false,
    sortLocked: noteBadgeFilter !== NOTE_BADGE_ALL_FILTER,
  };
  if (options.forceDragging) {
    noteDragState.dragging = true;
    applyNoteListDragItemStyle(item);
    noteDragState.dragIndex = moveNoteListItemToCursor(item, e.clientY);
    positionNoteListItemAtCursor(noteDragState, e.clientY);
  }
}

function isPointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isPointInSidePanel(e) {
  return isPointInRect(e.clientX, e.clientY, sidePanel.getBoundingClientRect());
}

function resetNoteListDragItem(item) {
  document.body.classList.remove("note-dragging");
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

function restoreNoteListOrder(state) {
  if (!state?.originalOrder?.length) return;
  const nodes = new Map([...notesList.querySelectorAll(".note-list-item")].map((node) => [node.dataset.noteId, node]));
  for (const noteId of state.originalOrder) {
    const node = nodes.get(noteId);
    if (node) notesList.appendChild(node);
  }
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
    const rect = node.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
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

async function startNoteExternalDrag(e) {
  if (!noteDragState || noteDragState.externalStarted) return;
  const state = noteDragState;
  state.externalStarted = true;
  state.mode = "external";
  restoreNoteListOrder(state);
  resetNoteListDragItem(state.item);
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
  applyNoteListDragItemStyle(state.item);
  if (!state.sortLocked) state.dragIndex = moveNoteListItemToCursor(state.item, e.clientY);
  positionNoteListItemAtCursor(state, e.clientY);
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

function cancelNoteDragByShortcut() {
  if (!noteDragState) return;
  const state = noteDragState;
  restoreNoteListOrder(state);
  resetNoteListDragItem(state.item);
  cleanupNoteExternalDrag();
  noteDragState = null;
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
    startNoteExternalDrag(e);
    return;
  }

  noteDragState.currentY = e.clientY - noteDragState.startY;
  item.style.transform = `translateY(${noteDragState.currentY}px)`;
  if (noteDragState.sortLocked) return;

  const items = [...notesList.querySelectorAll(".note-list-item")];
  const currentRect = item.getBoundingClientRect();
  const isDraggingPinnedNote = item.classList.contains("pinned");
  for (let i = 0; i < items.length; i++) {
    const target = items[i];
    if (target === item) continue;
    if (target.classList.contains("pinned") !== isDraggingPinnedNote) continue;

    const targetRect = target.getBoundingClientRect();
    const targetCenter = targetRect.top + targetRect.height / 2;

    if (noteDragState.currentY > 0 && currentRect.bottom > targetCenter && i > noteDragState.dragIndex) {
      const oldTop = currentRect.top;
      notesList.insertBefore(item, target.nextSibling);
      const newTop = item.getBoundingClientRect().top;
      noteDragState.currentY += oldTop - newTop;
      noteDragState.startY = e.clientY - noteDragState.currentY;
      noteDragState.dragIndex = i;
      item.style.transform = `translateY(${noteDragState.currentY}px)`;
      break;
    }

    if (noteDragState.currentY < 0 && currentRect.top < targetCenter && i < noteDragState.dragIndex) {
      const oldTop = currentRect.top;
      notesList.insertBefore(item, target);
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
  const { item, dragging } = noteDragState;
  if (noteDragState.mode === "external") {
    await finishNoteExternalDrag(e);
    return;
  }
  noteDragState = null;
  document.body.classList.remove("note-dragging");
  if (!dragging) return;
  suppressNoteClick = true;
  setTimeout(() => {
    suppressNoteClick = false;
  }, 0);
  item.classList.remove("dragging");
  item.style.transition = "";
  item.style.transform = "";
  item.style.position = "";
  item.style.zIndex = "";
  item.style.pointerEvents = "";
  const orderedIds = [...notesList.querySelectorAll(".note-list-item")]
    .map((node) => node.dataset.noteId)
    .filter(Boolean);
  if (noteBadgeFilter === NOTE_BADGE_ALL_FILTER) await window.electronAPI.reorderNotes({ orderedIds });
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
    active.element.querySelector(".name").textContent = active.name;
    active.element.querySelector(".name").title = active.name;
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
  noteContextMenu.style.display = "none";
  rightClickedNoteId = null;

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

noteContextMenu?.addEventListener("click", async (e) => {
  const edgeButton = e.target.closest("button[data-edge]");
  if (edgeButton) {
    e.stopPropagation();
    await toggleNoteBadgeEdge(edgeButton.dataset.edge);
    return;
  }

  const action = e.target.closest("button")?.dataset.action;
  if (!action || !rightClickedNoteId) return;
  const noteId = rightClickedNoteId;
  noteContextMenu.style.display = "none";
  rightClickedNoteId = null;

  switch (action) {
    case "copyText": {
      const content = await getLiveNoteContent(noteId);
      if (content !== null) await navigator.clipboard.writeText(content);
      break;
    }

    case "duplicate": {
      const result = await window.electronAPI.duplicateNote(noteId);
      if (result?.success) {
        const note = await window.electronAPI.readNote(result.id);
        const duplicatedTab = await createNoteTab(note?.content || "", null, note);
        if (duplicatedTab) {
          switchTab(duplicatedTab);
          updateRecentNote(duplicatedTab.noteId);
        }
        await renderNotesList();
        await populateRecentMenu();
      }
      break;
    }

    case "convertToUntitled":
      await convertNoteToUntitled(noteId);
      break;

    case "convertToFile":
      await convertNoteToFile(noteId);
      break;

    case "delete":
      await deleteNoteEverywhere(noteId, { trash: true });
      break;
  }
});

async function toggleNoteBadgeEdge(edgeKey) {
  if (!rightClickedNoteId) return;
  const edge = NOTE_BADGE_EDGES.find((item) => item.key === edgeKey);
  if (!edge) return;
  const noteId = rightClickedNoteId;
  const currentMask = normalizeNoteBadgeMask(getNoteMetaById(noteId)?.badgeMask);
  const nextMask = currentMask ^ edge.bit;
  const result = await window.electronAPI.updateNoteMeta({ noteId, badgeMask: nextMask });
  if (!result?.success) return;
  const cached = getNoteMetaById(noteId);
  if (cached) cached.badgeMask = nextMask;
  const openTab = getOpenNoteTabById(noteId);
  if (openTab) {
    openTab.noteBadgeMask = nextMask;
    updateTabNoteBadge(openTab);
    savePinnedTabsState();
  }
  updateNoteBadgeContextButtonsState();
  await renderNotesList();
  if (noteBadgeFilter !== NOTE_BADGE_ALL_FILTER && normalizeNoteBadgeMask(noteBadgeFilter) !== nextMask) {
    noteContextMenu.style.display = "none";
    rightClickedNoteId = null;
  }
  await populateRecentMenu();
}

// editor context menu display & position handler
editor.addEventListener("contextmenu", (e) => {
  e.preventDefault();

  tabContextMenu.style.display = "none";
  rightClickedTab = null;
  noteContextMenu.style.display = "none";
  rightClickedNoteId = null;

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
      isWordWrapOn = !isWordWrapOn;
      if (currentTab) currentTab.wordWrap = isWordWrapOn;
      monacoEditor.updateOptions({
        wordWrap: isWordWrapOn ? "on" : "off",
        ...WRAP_MEASURE_OPTIONS,
        scrollbar: {
          horizontal: isWordWrapOn ? "hidden" : "auto",
        },
      });
      {
        const btn = e.target.closest('button[data-action="wordWrap"]');
        if (btn) {
          const svg = btn.querySelector(".checkmark");
          if (svg) svg.style.display = isWordWrapOn ? "inline-flex" : "none";
        }
      }
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
    noteContextMenu.style.display = "none";
    rightClickedNoteId = null;
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

  if (isElementOpen(deviceShareModal)) {
    await closeDeviceShareModal();
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
window.addEventListener("keydown", async (e) => {
  if (e.code === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
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
