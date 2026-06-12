import { truncateNoteTitle } from "./app-utils.js";

export function createFileIconElement(className = "") {
  const icon = document.createElement("span");
  icon.className = ["file-icon", className].filter(Boolean).join(" ");
  return icon;
}

export function getDisplayNoteTitle(title) {
  const value = String(title || "");
  const displayTitle = value.replace(/^#\s+/, "");
  return displayTitle || value;
}

export function sortNotesForPanel(entries = []) {
  return [...entries].sort((a, b) => {
    if (Boolean(a?.pinned) !== Boolean(b?.pinned)) return a?.pinned ? -1 : 1;
    const aOrder = Number.isFinite(a?.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(b?.order) ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a?.createdAt || 0) - (b?.createdAt || 0);
  });
}

function normalizeFolderPath(folderPath) {
  return String(folderPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function getFolderName(folderPath) {
  return normalizeFolderPath(folderPath).split("/").filter(Boolean).pop() || "";
}

function getParentFolderPath(folderPath) {
  const value = normalizeFolderPath(folderPath);
  const index = value.lastIndexOf("/");
  return index === -1 ? "" : value.slice(0, index);
}

function getEntryKey(entry) {
  return entry?.type === "folder" ? `folder:${entry.path}` : `note:${entry?.id}`;
}

function isValidFolderName(name) {
  const value = String(name || "").trim();
  return Boolean(value) && value.length <= 100 && value !== "." && value !== ".." && !/[<>:"/\\|?*\x00-\x1f]/.test(value);
}

const NOTES_FOLDER_STORAGE_KEY = "notesCurrentFolderPath";

export function createNotesPanelController({
  i18next,
  electronAPI,
  refs,
  getNotesIndexCache,
  setNotesIndexCache,
  getCurrentTab,
  getNoteTitleFromContent,
  openNoteById,
  beginNoteListDrag,
  isNoteClickSuppressed,
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
  onShowContextMenu,
  onNotesIndexUpdated,
}) {
  const { notesList, notesListHeading, noteContextMenu } = refs;
  let rightClickedEntry = null;
  let currentFolderPath = normalizeFolderPath(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY));
  let draftFolderItem = null;
  let activeFolderEdit = null;

  function getEntryMeta(entry) {
    if (!entry) return null;
    if (entry.type === "folder") return getNotesIndexCache().find((item) => item.type === "folder" && item.path === entry.path) || entry;
    return getNotesIndexCache().find((item) => item.id === entry.id) || entry;
  }

  function updateFolderNav() {
    if (!notesListHeading) return;
    const inFolder = Boolean(currentFolderPath);
    const label = inFolder ? getFolderName(currentFolderPath) : i18next.t("sidePanel.notesSection");
    notesListHeading.classList.toggle("folder-heading", inFolder);
    notesListHeading.replaceChildren();
    const text = document.createElement("span");
    text.className = "notes-list-heading-text";
    text.textContent = label;
    notesListHeading.appendChild(text);
    if (inFolder) notesListHeading.setAttribute("role", "button");
    else notesListHeading.removeAttribute("role");
    notesListHeading.tabIndex = inFolder ? 0 : -1;
    notesListHeading.setAttribute("aria-label", inFolder ? i18next.t("sidePanel.parentFolder") : i18next.t("sidePanel.notesSection"));
    notesListHeading.title = label;
  }

  function saveCurrentFolderPath() {
    if (currentFolderPath) localStorage.setItem(NOTES_FOLDER_STORAGE_KEY, currentFolderPath);
    else localStorage.removeItem(NOTES_FOLDER_STORAGE_KEY);
  }

  async function ensureCurrentFolderExists() {
    if (!currentFolderPath) return;
    const folderPath = currentFolderPath;
    const parentPath = getParentFolderPath(folderPath);
    const siblings = await electronAPI.listNotes({ folderPath: parentPath });
    const exists = Array.isArray(siblings) && siblings.some((entry) => entry?.type === "folder" && normalizeFolderPath(entry.path) === folderPath);
    if (!exists) {
      currentFolderPath = "";
      saveCurrentFolderPath();
    }
  }

  function updateContextPinButtonState() {
    if (!noteContextMenu || !rightClickedEntry) return;
    const button = noteContextMenu.querySelector('button[data-action="togglePin"]');
    if (!button) return;
    const entry = getEntryMeta(rightClickedEntry);
    const label = entry?.pinned ? i18next.t("sidePanel.unpin") : i18next.t("sidePanel.pin");
    button.textContent = label;
  }

  function updateContextMenuItems() {
    if (!noteContextMenu || !rightClickedEntry) return;
    const isFolder = rightClickedEntry.type === "folder";
    noteContextMenu.querySelectorAll("[data-note-only]").forEach((item) => {
      item.hidden = isFolder;
      item.style.display = isFolder ? "none" : "";
    });
    noteContextMenu.querySelectorAll("[data-folder-only]").forEach((item) => {
      item.hidden = !isFolder;
      item.style.display = isFolder ? "" : "none";
    });
    updateContextPinButtonState();
  }

  function showContextMenu(e, entry) {
    e.preventDefault();
    e.stopPropagation();
    onShowContextMenu?.();
    rightClickedEntry = entry;

    noteContextMenu.style.display = "block";
    noteContextMenu.style.visibility = "hidden";
    updateContextMenuItems();
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
  }

  async function renderNotesList({ scheduleSearch = true } = {}) {
    if (!notesList) return;
    cancelFolderDraft();
    await ensureCurrentFolderExists();
    updateFolderNav();
    const panelEntries = await electronAPI.listNotes({ folderPath: currentFolderPath });
    const allNotes = await electronAPI.listNotes();
    const folders = Array.isArray(panelEntries)
      ? panelEntries.filter((entry) => entry?.type === "folder")
      : [];
    setNotesIndexCache([...folders, ...(Array.isArray(allNotes) ? allNotes : [])]);
    onNotesIndexUpdated?.(getNotesIndexCache());
    const fragment = document.createDocumentFragment();

    for (const entry of sortNotesForPanel(Array.isArray(panelEntries) ? panelEntries : [])) {
      if (entry?.type === "folder") fragment.appendChild(createFolderItem(entry));
      else if (entry?.id) fragment.appendChild(createNoteItem(entry));
    }
    notesList.replaceChildren(fragment);

    updateActiveNoteListItem();
    updateGlobalSearchActionState();
    if (scheduleSearch && isGlobalSearchActive()) scheduleGlobalSearch();
  }

  function createFolderItem(folder) {
    const item = document.createElement("div");
    item.className = `note-list-item folder-list-item${folder.pinned ? " pinned" : ""}`;
    item.dataset.entryType = "folder";
    item.dataset.folderPath = folder.path;
    item.dataset.entryKey = getEntryKey(folder);

    const fileIcon = createFileIconElement("note-list-file-icon");
    fileIcon.title = i18next.t("sidePanel.folderIcon");
    const title = document.createElement("span");
    title.className = "note-list-title";
    title.textContent = folder.name || getFolderName(folder.path);
    title.title = title.textContent;

    const pinButton = createPinButton(folder);
    const count = document.createElement("span");
    count.className = "note-list-count";
    count.textContent = String(Math.max(0, Number(folder.noteCount) || 0));
    item.append(fileIcon, title, count, pinButton);
    item.addEventListener("click", async (e) => {
      if (e.target.closest(".note-list-rename-input") || item.querySelector(".note-list-rename-input")) return;
      if (isNoteClickSuppressed()) return;
      await openFolder(folder.path);
    });
    item.addEventListener("contextmenu", (e) => showContextMenu(e, folder));
    item.addEventListener("mousedown", (e) => beginNoteListDrag(e, item));
    return item;
  }

  function createNoteItem(note) {
    const item = document.createElement("div");
    item.className = `note-list-item${note.pinned ? " pinned" : ""}`;
    item.dataset.entryType = "note";
    item.dataset.noteId = note.id;
    item.dataset.entryKey = getEntryKey(note);

    const fileIcon = createFileIconElement("note-list-file-icon");
    fileIcon.classList.toggle("has-heading", Boolean(note.hasHeadings));
    if (note.hasHeadings) fileIcon.title = i18next.t("sidePanel.foldableStructureIcon");
    const title = document.createElement("span");
    title.className = "note-list-title";
    const rawTitle = truncateNoteTitle(note.title || getNoteTitleFromContent(""));
    title.textContent = getDisplayNoteTitle(rawTitle);
    title.title = rawTitle;

    const pinButton = createPinButton(note);
    item.append(fileIcon, title, pinButton);
    item.addEventListener("click", async () => {
      if (isNoteClickSuppressed()) return;
      await openNoteById(note.id, { preview: true });
    });
    item.addEventListener("dblclick", async () => {
      if (isNoteClickSuppressed()) return;
      await openNoteById(note.id, { preview: false });
    });
    item.addEventListener("auxclick", async (e) => {
      if (e.button !== 1 || isNoteClickSuppressed()) return;
      e.preventDefault();
      await openNoteById(note.id, { preview: false });
    });
    item.addEventListener("contextmenu", (e) => showContextMenu(e, note));
    item.addEventListener("mousedown", (e) => beginNoteListDrag(e, item));
    return item;
  }

  function createPinButton(entry) {
    const pinButton = document.createElement("button");
    pinButton.className = `note-pin-button codicon ${entry.pinned ? "codicon-pinned" : "codicon-pin"}`;
    pinButton.type = "button";
    const pinLabel = entry.pinned ? i18next.t("sidePanel.unpin") : i18next.t("sidePanel.pin");
    pinButton.setAttribute("aria-label", pinLabel);
    pinButton.title = pinLabel;
    pinButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      await toggleEntryPinned(entry);
    });
    return pinButton;
  }

  function updateActiveNoteListItem() {
    if (!notesList) return;
    const activeNoteId = getCurrentTab()?.isNote && getCurrentTab().noteId ? getCurrentTab().noteId : null;
    notesList.querySelectorAll(".note-list-item").forEach((item) => {
      item.classList.toggle("active-note", Boolean(activeNoteId && item.dataset.noteId === activeNoteId));
    });
  }

  async function toggleEntryPinned(entryInput) {
    const entry = getEntryMeta(entryInput);
    if (!entry) return false;
    const result =
      entry.type === "folder"
        ? await electronAPI.updateFolderMeta({ folderPath: entry.path, pinned: !entry.pinned })
        : await electronAPI.updateNoteMeta({ noteId: entry.id, pinned: !entry.pinned });
    if (!result?.success) return false;
    await renderNotesList();
    await populateRecentMenu();
    updateContextPinButtonState();
    return true;
  }

  async function handleContextMenuClick(e) {
    const action = e.target.closest("button")?.dataset.action;
    if (!action || !rightClickedEntry) return;
    const entry = rightClickedEntry;
    closeContextMenu();

    switch (action) {
      case "togglePin":
        await toggleEntryPinned(entry);
        break;

      case "rename":
        if (entry.type === "folder") beginRenameFolder(entry);
        break;

      case "copyText": {
        if (entry.type !== "note") break;
        const content = await getLiveNoteContent(entry.id);
        if (content !== null) await navigator.clipboard.writeText(content);
        break;
      }

      case "duplicate": {
        if (entry.type !== "note") break;
        const result = await electronAPI.duplicateNote(entry.id);
        if (result?.success) {
          const note = await electronAPI.readNote(result.id);
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
        if (entry.type === "note") await convertNoteToUntitled(entry.id);
        break;

      case "convertToFile":
        if (entry.type === "note") await convertNoteToFile(entry.id);
        break;

      case "delete":
        if (entry.type === "folder") await deleteFolderEverywhere(entry.path);
        else await deleteNoteEverywhere(entry.id, { trash: true });
        break;
    }
  }

  async function openFolder(folderPath) {
    currentFolderPath = normalizeFolderPath(folderPath);
    saveCurrentFolderPath();
    await renderNotesList();
  }

  async function openParentFolder() {
    if (!currentFolderPath) return;
    currentFolderPath = getParentFolderPath(currentFolderPath);
    saveCurrentFolderPath();
    await renderNotesList();
  }

  function createFolderDraft() {
    if (!notesList || draftFolderItem) return;
    closeContextMenu();
    updateFolderNav();
    draftFolderItem = document.createElement("div");
    draftFolderItem.className = "note-list-item folder-list-item editing";

    const fileIcon = createFileIconElement("note-list-file-icon");
    fileIcon.title = i18next.t("sidePanel.folderIcon");
    const input = document.createElement("input");
    input.className = "note-list-rename-input";
    input.type = "text";
    input.maxLength = 100;
    input.spellcheck = false;
    input.setAttribute("aria-label", i18next.t("sidePanel.newFolder"));
    draftFolderItem.append(fileIcon, input);
    const firstUnpinnedItem = [...notesList.querySelectorAll(".note-list-item")].find((item) => !item.classList.contains("pinned"));
    notesList.insertBefore(draftFolderItem, firstUnpinnedItem || null);

    let done = false;
    const finish = async (save) => {
      if (done) return;
      done = true;
      input.removeEventListener("blur", commit);
      if (!draftFolderItem) return;
      const name = input.value.trim();
      if (!save || !isValidFolderName(name)) {
        activeFolderEdit = null;
        cancelFolderDraft();
        return;
      }
      const result = await electronAPI.createFolder({ parentPath: currentFolderPath, name });
      activeFolderEdit = null;
      cancelFolderDraft();
      if (result?.success) await renderNotesList();
    };
    activeFolderEdit = { item: draftFolderItem, input, finish };
    const commit = () => setTimeout(() => finish(true), 0);
    input.addEventListener("keydown", async (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        await finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        await finish(true);
      }
    });
    input.addEventListener("blur", commit);
    requestAnimationFrame(() => input.focus());
  }

  function beginRenameFolder(folder) {
    const item = notesList?.querySelector(`.note-list-item[data-folder-path="${CSS.escape(folder.path)}"]`);
    if (!item) return;
    const title = item.querySelector(".note-list-title");
    if (!title) return;
    const input = document.createElement("input");
    input.className = "note-list-rename-input";
    input.type = "text";
    input.maxLength = 100;
    input.value = folder.name || getFolderName(folder.path);
    input.spellcheck = false;
    ["pointerdown", "mousedown", "mouseup", "click", "dblclick"].forEach((eventName) => {
      input.addEventListener(eventName, (e) => e.stopPropagation());
    });
    title.replaceWith(input);
    input.select();

    let done = false;
    const finish = async (save) => {
      if (done) return;
      done = true;
      activeFolderEdit = null;
      const name = input.value.trim();
      if (save && isValidFolderName(name)) await electronAPI.renameFolder({ folderPath: folder.path, name });
      await renderNotesList();
    };
    activeFolderEdit = { item, input, finish };
    input.addEventListener("keydown", async (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        await finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        await finish(true);
      }
    });
    input.addEventListener("blur", () => setTimeout(() => finish(true), 0));
  }

  function cancelFolderDraft() {
    if (!draftFolderItem) return;
    const item = draftFolderItem;
    draftFolderItem = null;
    if (activeFolderEdit?.item === item) activeFolderEdit = null;
    if (item.parentNode) item.remove();
  }

  function closeContextMenu() {
    if (noteContextMenu) noteContextMenu.style.display = "none";
    rightClickedEntry = null;
  }

  async function continueListMouseDownAfterEdit(e) {
    if (!activeFolderEdit || activeFolderEdit.item.contains(e.target)) return;
    const targetItem = e.target.closest(".note-list-item");
    if (!targetItem || !notesList?.contains(targetItem)) return;
    const entry =
      targetItem.dataset.entryType === "folder"
        ? getNotesIndexCache().find((item) => item.type === "folder" && item.path === targetItem.dataset.folderPath)
        : getNotesIndexCache().find((item) => item.id === targetItem.dataset.noteId);
    if (!entry) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const button = e.button;
    await activeFolderEdit.finish(true);
    if (button === 0) {
      if (entry.type === "folder") await openFolder(entry.path);
      else await openNoteById(entry.id, { preview: true });
    } else if (button === 1 && entry.type !== "folder") {
      await openNoteById(entry.id, { preview: false });
    } else if (button === 2) {
      showContextMenu(e, entry);
    }
  }

  notesList?.addEventListener("mousedown", continueListMouseDownAfterEdit, true);
  notesListHeading?.addEventListener("click", () => {
    if (currentFolderPath) openParentFolder();
  });
  notesListHeading?.addEventListener("keydown", (e) => {
    if (!currentFolderPath || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    openParentFolder();
  });
  noteContextMenu?.addEventListener("click", handleContextMenuClick);

  return {
    renderNotesList,
    updateActiveNoteListItem,
    createFolderDraft,
    openFolder,
    openParentFolder,
    getCurrentFolderPath() {
      return currentFolderPath;
    },
    closeContextMenu,
    isContextMenuOpen() {
      return noteContextMenu?.style.display !== "none";
    },
    isEditingFolderName() {
      return Boolean(draftFolderItem || notesList?.querySelector(".note-list-rename-input"));
    },
  };
}
