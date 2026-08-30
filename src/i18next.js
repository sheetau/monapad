function qs(selector) {
  return document.querySelector(selector);
}

function byId(id) {
  return document.getElementById(id);
}

function setText(selector, value) {
  const el = selector.startsWith("#") && !selector.includes(" ") ? byId(selector.slice(1)) : qs(selector);
  setElementText(el, value);
}

function setElementText(el, value) {
  if (el) el.textContent = value;
}

function setHtml(selector, value) {
  const el = selector.startsWith("#") && !selector.includes(" ") ? byId(selector.slice(1)) : qs(selector);
  if (el) el.innerHTML = value;
}

function setTitle(selector, title) {
  const el = qs(selector);
  if (el) el.title = title || "";
}

function removeTitle(selector) {
  const el = qs(selector);
  if (el) el.removeAttribute("title");
}

function setAriaTitle(el, label) {
  if (!el) return;
  el.setAttribute("aria-label", label);
  el.title = label;
}

function setTexts(t, entries) {
  entries.forEach(([selector, key]) => setText(selector, t(key)));
}

function setHtmls(t, entries) {
  entries.forEach(([selector, key]) => setHtml(selector, t(key)));
}

export function updateSettingsTooltipsUi({ t, selectedFontFamily }) {
  removeTitle("#settingsLayout .h1");
  setTitle("#default-new-tab-note", t("settings.defaultNewTabNote"));
  setTitle("#line-highlight", t("settings.highlightLine"));
  setTitle("#line-num", t("settings.lineNumbers"));
  setTitle("#toggleFolding", t("settings.folding"));
  setTitle("#minimap", t("settings.displayMinimap"));
  setTitle("#toggleSyntaxHighlight", t("settings.syntaxHighlight"));
  setTitle("#toggleStatusBar", t("settings.statusBar"));
  setTitle("#toggleKuromoji", t("settings.kuromoji"));
  setTitle("#settings-menu .tabSize", t("settings.tabSize"));
  removeTitle("#settings-menu .font .h1");
  setTitle(".font-select-row .custom-select__trigger", selectedFontFamily);
  setTitle(".font-select-row .custom-select__input", selectedFontFamily);
  setTitle("#settings-menu .size", t("settings.size"));
  removeTitle("#settingsCustomTheme");
  setTitle("#openThemeFolder", t("settings.openThemeFolder"));
  removeTitle("#settingsLanguage");
}

export function updateStaticUiText({
  t,
  refs,
  state,
  callbacks,
}) {
  setTexts(t, [
    ["#newTabBtn .label", "menu.new"],
    ["#newNoteBtn .label", "menu.newNote"],
    ["#newWindowBtn .label", "menu.newWindow"],
    ["#openFileBtn .label", "menu.open"],
    ["#openRecent .btn-text", "menu.openRecent"],
    ["#saveFileBtn .label", "menu.save"],
    ["#saveAsFileBtn .label", "menu.saveAs"],
    ["#saveAsNoteBtn .label", "menu.saveAsNote"],
    ["#triggerFindBtn .label", "menu.find"],
    ["#triggerReplaceBtn .label", "menu.replace"],
    ["#triggerGoToLineBtn .label", "menu.goToLine"],
    ["#triggerGoToSymbolBtn .label", "menu.goToSymbol"],
    ["#triggerQuickOpenBtn .label", "menu.quickOpen"],
    ["#triggerShowCommandsBtn .label", "menu.showCommands"],
    ["#changeTheme .btn-text", "menu.theme"],
    ["#settingsBtn .label", "menu.settings"],
    ["#toggleSidePanelBtn .label", "menu.sidePanel"],
    ["#aboutBtn", "menu.about"],
    ['button[data-theme="onyx"] span', "menu.onyx"],
    ['button[data-theme="dark"] span', "menu.dark"],
    ['button[data-theme="ash"] span', "menu.ash"],
    ["#file-saved", "message.saved"],
    ["#file-opened", "message.fileAlreadyOpened"],
    ["#file-updated", "message.fileUpdated"],
    ["#file-modified", "message.fileModified"],
    ["#autosave-restored", "message.autosaveRestored"],
    ['button[data-action="cut"] .label', "editorMenu.cut"],
    ['button[data-action="copy"] .label', "editorMenu.copy"],
    ['button[data-action="paste"] .label', "editorMenu.paste"],
    ['button[data-action="undo"] .label', "editorMenu.undo"],
    ['button[data-action="redo"] .label', "editorMenu.redo"],
    ['button[data-action="selectAll"] .label', "editorMenu.selectAll"],
    ['button[data-action="wordWrap"] span', "editorMenu.wordWrap"],
    ['button[data-action="toggleMarkdown"] span', "editorMenu.markdownMode"],
    ['button[data-action="close"] .label', "tabMenu.close"],
    ['button[data-action="closeOthers"] .label', "tabMenu.closeOthers"],
    ['button[data-action="closeToRight"] .label', "tabMenu.closeToRight"],
    ['button[data-action="closeSaved"] .label', "tabMenu.closeSaved"],
    ['button[data-action="copyPath"] .label', "tabMenu.copyPath"],
    ['button[data-action="openPath"] .label', "tabMenu.openPath"],
    ['button[data-action="reopenClosedTab"] .label', "tabMenu.reopenClosedTab"],
    ['button[data-action="openInNewWindow"] .label', "tabMenu.openInNewWindow"],
    ['button[data-action="keepOpen"] .label', "tabMenu.keepOpen"],
    ['#note-context-menu button[data-action="togglePin"]', "sidePanel.pin"],
    ['#note-context-menu button[data-action="copyText"]', "sidePanel.copyText"],
    ['#note-context-menu button[data-action="duplicate"]', "sidePanel.duplicate"],
    ['#note-context-menu button[data-action="convertToUntitled"]', "sidePanel.convertToUntitled"],
    ['#note-context-menu button[data-action="convertToFile"]', "sidePanel.convertToFile"],
    ['#note-context-menu button[data-action="rename"]', "sidePanel.rename"],
    ['#note-context-menu button[data-action="delete"]', "sidePanel.delete"],
    ["#settings-menu .font .h1", "settings.font"],
    ["#settings-menu .size", "settings.size"],
    ["#settingsLayout .h1", "settings.layout"],
    ["#toggleStatusBar span", "settings.statusBar"],
    ["#toggleKuromoji span", "settings.kuromoji"],
    ["#default-new-tab-note span", "settings.defaultNewTabNote"],
    ["#line-highlight span", "settings.highlightLine"],
    ["#line-num span", "settings.lineNumbers"],
    ["#minimap span", "settings.displayMinimap"],
    ["#toggleSyntaxHighlight span", "settings.syntaxHighlight"],
    ["#toggleFolding span", "settings.folding"],
    ["#settings-menu .tabSize", "settings.tabSize"],
    ["#settingsLanguage", "settings.language"],
    ["#settingsCustomTheme", "settings.customTheme"],
    ["#openThemeFolder", "settings.openThemeFolder"],
    ["#file-drop p", "modal.fileDrop"],
    ["#discordServer", "modal.discordServer"],
    ["#website", "modal.website"],
    ["#creator", "modal.creator"],
    ["#disclaimer-title", "modal.disclaimer"],
  ]);

  setHtmls(t, [
    ["#langDescription", "settings.langDescription"],
    ["#customThemeDescription", "settings.customThemeDescription"],
    ["#confirm-save-yes", "modal.confirmSave"],
    ["#confirm-save-no", "modal.dontSave"],
    ["#confirm-save-cancel", "modal.cancel"],
    ["#confirm-save-all", "modal.saveAll"],
    ["#confirm-discard-all", "modal.discardAll"],
    ["#confirm-cancel-all", "modal.cancel"],
  ]);

  setText("#confirm-save-window p", t("modal.confirmSaveWindow"));
  refs.deviceShareController?.updateLabels();
  callbacks.updateSessionRestoreChoices?.();
  callbacks.updateMainMenuState();
  callbacks.updateTabContextMenuState(refs.tabContextMenu, state.rightClickedTab);
  callbacks.updateGlobalSearchPlaceholder(document.activeElement === refs.globalSearchInput);
  callbacks.updateGlobalSearchLabels();
  callbacks.updateGlobalSearchResultHeaderLabels();

  setElementText(refs.notesListHeading, t("sidePanel.notesSection"));
  if (refs.globalSearchHeading) {
    const label = t("sidePanel.searchSection");
    setElementText(refs.globalSearchHeading, label);
    refs.globalSearchHeading.title = `${label} (Ctrl+Shift+F)`;
  }
  setAriaTitle(refs.notesAddButton, t("sidePanel.newNote"));
  setAriaTitle(refs.foldersAddButton, t("sidePanel.newFolder"));
  setAriaTitle(refs.notesListRefreshButton, t("sidePanel.refresh"));
  if (refs.sidePanelClose) refs.sidePanelClose.setAttribute("aria-label", t("sidePanel.closePanel"));

  if (refs.monacoNlsRestartWarning) {
    setElementText(refs.monacoNlsRestartWarning, t("settings.monacoRestartWarning"));
  }
  const kuromojiToggle = qs("#toggleKuromoji");
  if (kuromojiToggle) kuromojiToggle.title = t("settings.kuromojiTooltip");
  const fontReset = qs(".font .reset");
  if (fontReset) fontReset.title = t("settings.resetTooltip");
  const layoutReset = qs("#settingsLayout .reset");
  if (layoutReset) layoutReset.title = t("settings.resetTooltip");

  updateSettingsTooltipsUi({ t, selectedFontFamily: state.selectedFontFamily });
  callbacks.updateNewTabShortcutLabels();

  setElementText(refs.autosaveRestoreMessage, t("autosave.restoreMessage"));
  setElementText(refs.autosaveRestoreYes, t("autosave.restore"));
  setElementText(refs.autosaveRestoreNo, t("autosave.discard"));
  setTitle("#menu-button", t("menu.sidePanelDragHint"));
}
