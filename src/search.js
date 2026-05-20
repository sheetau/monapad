import {
  GLOBAL_SEARCH_PREVIEW_MAX,
  clampNumber,
  escapeSearchPreview,
  getSearchResultPathDisplay,
  normalizeSearchPreviewText,
  truncateNoteTitle,
} from "./app-utils.js";

const GLOBAL_SEARCH_DEBOUNCE_MS = 120;
const GLOBAL_SEARCH_MAX_MATCHES = 10000;
const GLOBAL_SEARCH_WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
const GLOBAL_SEARCH_HOVER_MAX = 100;
const GLOBAL_SEARCH_BEFORE_MAX_RATIO = 0.7;
const GLOBAL_SEARCH_MATCH_MIN_RATIO = 0.3;
const GLOBAL_SEARCH_HISTORY_LIMIT = 100;
const GLOBAL_SEARCH_INPUT_MIN_HEIGHT = 26;
const GLOBAL_SEARCH_INPUT_MAX_HEIGHT = 118;
const GLOBAL_SEARCH_IDLE_PREVIEW_BATCH = 16;

export function createGlobalSearchController({
  monaco,
  i18next,
  electronAPI,
  refs,
  getTabData,
  getNotesIndexCache,
  sortNotesForPanel,
  getNoteTitleFromContent,
  openNoteById,
  switchTab,
  revealSearchRange,
  getMonacoEditor,
  onBeginMatchDrag,
  isMatchClickSuppressed,
}) {
  const {
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
  } = refs;

  let globalSearchTimer = null;
  let globalSearchSeq = 0;
  let globalSearchPreviewFrame = null;
  let globalSearchPreviewIdleHandle = null;
  let globalSearchFilePathFrame = null;
  let globalSearchMeasureContext = null;
  let globalSearchPreviewObserver = null;
  let globalSearchHistory = [];
  let globalSearchHistoryIndex = -1;
  let globalSearchHistoryDraft = "";
  let globalSearchResultsSignature = "";
  const globalSearchVisiblePreviewRows = new Set();
  const globalSearchIdlePreviewRows = new Set();
  const globalSearchPreviewDisplayCache = new Map();
  const noteContentCache = new Map();
  const globalSearchState = {
    query: "",
    matchCase: false,
    wholeWord: false,
    regex: false,
    results: [],
    totalMatches: 0,
    totalItems: 0,
    limitHit: false,
    dismissedMatches: new Set(),
    collapsedTargetIds: new Set(),
    allCollapsed: false,
  };
  let openTabSearchIdSeq = 0;

function resetGlobalSearchTransientState({ invalidateSignature = false } = {}) {
  globalSearchState.dismissedMatches.clear();
  globalSearchState.allCollapsed = false;
  globalSearchState.collapsedTargetIds.clear();
  if (invalidateSignature) globalSearchResultsSignature = "";
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
  resetGlobalSearchTransientState({ invalidateSignature: true });
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
  resetGlobalSearchTransientState({ invalidateSignature: true });
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
  resetGlobalSearchTransientState({ invalidateSignature: true });
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

async function refreshGlobalSearchNow() {
  if (globalSearchTimer) {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = null;
  }
  resetGlobalSearchTransientState({ invalidateSignature: true });
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

  getTabData().forEach((tab, index) => {
    if (!tab) return;
    if (tab.isNotePreview) return;
    if (tab.isNote && tab.noteId) openNoteIds.add(tab.noteId);
    targets.push(createOpenTabSearchTarget(tab, index));
  });

  notes.forEach((note, index) => {
    if (!note?.id || openNoteIds.has(note.id)) return;
    targets.push(createGlobalSearchTarget(note, getTabData().length + index));
  });

  return targets;
}

async function getSearchableTargetContent(target) {
  if (target.type === "tab") {
    if (!getTabData().includes(target.tab)) return null;
    return target.tab.model?.getValue() ?? target.tab.content ?? "";
  }
  if (target.tab && getTabData().includes(target.tab)) {
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
  const openTab = getTabData().find((tab) => tab.isNote && tab.noteId === note.id);
  if (openTab) {
    const content = openTab.model?.getValue() ?? openTab.content ?? "";
    noteContentCache.set(note.id, { updatedAt: openTab.noteUpdatedAt || note.updatedAt || 0, content });
    return content;
  }

  const cached = noteContentCache.get(note.id);
  if (cached && cached.updatedAt === (note.updatedAt || 0)) return cached.content;

  const fullNote = await electronAPI.readNote(note.id);
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
      Array.isArray(getNotesIndexCache()) && getNotesIndexCache().length ? getNotesIndexCache() : await electronAPI.listNotes(),
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
    if (isMatchClickSuppressed?.()) return;
    await openGlobalSearchMatch(match, { preview: true });
  });
  row.addEventListener("dblclick", async () => {
    if (isMatchClickSuppressed?.()) return;
    await openGlobalSearchMatch(match, { preview: false });
  });
  row.addEventListener("auxclick", async (e) => {
    if (e.button !== 1 || isMatchClickSuppressed?.()) return;
    e.preventDefault();
    await openGlobalSearchMatch(match, { preview: false });
  });
  row.addEventListener("mousedown", (e) => onBeginMatchDrag?.(e, row, match));
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
      ? getTabData().find((item) => item._searchTargetId === match.tabId)
      : await openNoteById(match.noteId, { preview: options.preview !== false });
  if (!tab || !getMonacoEditor?.()) return;
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
  updateGlobalSearchToggleState();
  resizeGlobalSearchInput();
  updateGlobalSearchPlaceholder(document.activeElement === globalSearchInput);

  return {
    getQuery: getGlobalSearchQuery,
    isActive: isGlobalSearchActive,
    schedule: scheduleGlobalSearch,
    scheduleAfterTabSetChange: scheduleGlobalSearchAfterTabSetChange,
    schedulePreviewUpdate: scheduleGlobalSearchPreviewUpdate,
    scheduleFilePathUpdate: scheduleGlobalSearchFilePathUpdate,
    updateActionState: updateGlobalSearchActionState,
    updateLabels: updateGlobalSearchLabels,
    updatePlaceholder: updateGlobalSearchPlaceholder,
    updateResultHeaderLabels: updateGlobalSearchResultHeaderLabels,
    refreshNow: refreshGlobalSearchNow,
    clearInput: clearGlobalSearchInput,
    clearPendingSearch() {
      if (globalSearchTimer) {
        clearTimeout(globalSearchTimer);
        globalSearchTimer = null;
      }
    },
    clearNoteContentCache() {
      noteContentCache.clear();
    },
  };
}
