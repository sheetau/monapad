import {
  NOTE_BADGE_ALL_FILTER,
  NOTE_BADGE_EDGES,
  countNoteBadgeEdges,
  getNoteBadgeClass,
  normalizeNoteBadgeMask,
  truncateNoteTitle,
} from "./app-utils.js";

const NOTE_BADGE_STORAGE_KEY = "monapadNoteBadgesVisible";
const NOTE_BADGE_FILTER_STORAGE_KEY = "monapadNoteBadgeFilter";

export function createNoteBadgeElement(mask, className = "") {
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

export function updateNoteBadgeElement(badge, mask) {
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

export function sortNotesForPanel(notes = []) {
  return [...notes].sort((a, b) => {
    if (Boolean(a?.pinned) !== Boolean(b?.pinned)) return a?.pinned ? -1 : 1;
    const aOrder = Number.isFinite(a?.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(b?.order) ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a?.createdAt || 0) - (b?.createdAt || 0);
  });
}

function getNoteBadgeFilterMasks(notes) {
  const masks = [...new Set(notes.map((note) => normalizeNoteBadgeMask(note.badgeMask)))];
  return masks.sort((a, b) => {
    const countDiff = countNoteBadgeEdges(b) - countNoteBadgeEdges(a);
    if (countDiff) return countDiff;
    return a - b;
  });
}

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
  getOpenNoteTabById,
  updateTabNoteBadge,
  savePinnedTabsState,
  onShowContextMenu,
  onNotesIndexUpdated,
}) {
  const { notesList, notesBadgeFilterBar, notesBadgeToggleButton, noteContextMenu } = refs;
  let rightClickedNoteId = null;
  let areNoteBadgesVisible = localStorage.getItem(NOTE_BADGE_STORAGE_KEY) !== "false";
  let noteBadgeFilter = localStorage.getItem(NOTE_BADGE_FILTER_STORAGE_KEY) || NOTE_BADGE_ALL_FILTER;

  function getVisibleNotesForPanel(notes) {
    if (noteBadgeFilter === NOTE_BADGE_ALL_FILTER) return notes;
    const targetMask = normalizeNoteBadgeMask(noteBadgeFilter);
    return notes.filter((note) => normalizeNoteBadgeMask(note.badgeMask) === targetMask);
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

  function getNoteMetaById(noteId) {
    return getNotesIndexCache().find((note) => note.id === noteId) || null;
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

  function updateNoteContextPinButtonState() {
    if (!noteContextMenu || !rightClickedNoteId) return;
    const button = noteContextMenu.querySelector('button[data-action="togglePin"]');
    if (!button) return;
    const note = getNoteMetaById(rightClickedNoteId);
    const label = note?.pinned ? i18next.t("sidePanel.unpinNote") : i18next.t("sidePanel.pinNote");
    button.textContent = label;
  }

  function showNoteContextMenu(e, noteId) {
    e.preventDefault();
    e.stopPropagation();
    onShowContextMenu?.();
    rightClickedNoteId = noteId;

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
    updateNoteContextPinButtonState();
  }

  function renderNoteBadgeFilterBar() {
    if (!notesBadgeFilterBar) return;
    notesBadgeFilterBar.innerHTML = "";
    const availableMasks = getNoteBadgeFilterMasks(getNotesIndexCache());
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
    const notes = await electronAPI.listNotes();
    setNotesIndexCache(sortNotesForPanel(Array.isArray(notes) ? notes : []));
    onNotesIndexUpdated?.(getNotesIndexCache());
    if (noteBadgeFilter !== NOTE_BADGE_ALL_FILTER) {
      const hasFilter = getNotesIndexCache().some(
        (note) => normalizeNoteBadgeMask(note.badgeMask) === normalizeNoteBadgeMask(noteBadgeFilter),
      );
      if (!hasFilter) noteBadgeFilter = NOTE_BADGE_ALL_FILTER;
    }
    renderNoteBadgeFilterBar();
    notesList.innerHTML = "";

    for (const note of getVisibleNotesForPanel(getNotesIndexCache())) {
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
        await toggleNotePinned(note.id);
      });

      item.append(badge, title, pinButton);
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
    const activeNoteId = getCurrentTab()?.isNote && getCurrentTab().noteId ? getCurrentTab().noteId : null;
    notesList.querySelectorAll(".note-list-item").forEach((item) => {
      item.classList.toggle("active-note", Boolean(activeNoteId && item.dataset.noteId === activeNoteId));
    });
  }

  async function toggleNotePinned(noteId) {
    const note = getNoteMetaById(noteId);
    if (!note) return false;
    const result = await electronAPI.updateNoteMeta({ noteId, pinned: !note.pinned });
    if (!result?.success) return false;
    const cached = getNoteMetaById(noteId);
    if (cached) {
      cached.pinned = Boolean(result.note?.pinned);
      if (Number.isFinite(result.note?.order)) cached.order = result.note.order;
    }
    await renderNotesList();
    await populateRecentMenu();
    updateNoteContextPinButtonState();
    return true;
  }

  async function toggleNoteBadgeEdge(edgeKey) {
    if (!rightClickedNoteId) return;
    const edge = NOTE_BADGE_EDGES.find((item) => item.key === edgeKey);
    if (!edge) return;
    const noteId = rightClickedNoteId;
    const currentMask = normalizeNoteBadgeMask(getNoteMetaById(noteId)?.badgeMask);
    const nextMask = currentMask ^ edge.bit;
    const result = await electronAPI.updateNoteMeta({ noteId, badgeMask: nextMask });
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
      closeContextMenu();
    }
    await populateRecentMenu();
  }

  async function handleContextMenuClick(e) {
    const edgeButton = e.target.closest("button[data-edge]");
    if (edgeButton) {
      e.stopPropagation();
      await toggleNoteBadgeEdge(edgeButton.dataset.edge);
      return;
    }

    const action = e.target.closest("button")?.dataset.action;
    if (!action || !rightClickedNoteId) return;
    const noteId = rightClickedNoteId;
    closeContextMenu();

    switch (action) {
      case "togglePin":
        await toggleNotePinned(noteId);
        break;

      case "copyText": {
        const content = await getLiveNoteContent(noteId);
        if (content !== null) await navigator.clipboard.writeText(content);
        break;
      }

      case "duplicate": {
        const result = await electronAPI.duplicateNote(noteId);
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
        await convertNoteToUntitled(noteId);
        break;

      case "convertToFile":
        await convertNoteToFile(noteId);
        break;

      case "delete":
        await deleteNoteEverywhere(noteId, { trash: true });
        break;
    }
  }

  function closeContextMenu() {
    if (noteContextMenu) noteContextMenu.style.display = "none";
    rightClickedNoteId = null;
  }

  function toggleBadgesVisible() {
    areNoteBadgesVisible = !areNoteBadgesVisible;
    localStorage.setItem(NOTE_BADGE_STORAGE_KEY, String(areNoteBadgesVisible));
  }

  notesBadgeFilterBar?.addEventListener(
    "wheel",
    (e) => {
      if (!notesBadgeFilterBar || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      notesBadgeFilterBar.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
  noteContextMenu?.addEventListener("click", handleContextMenuClick);

  return {
    renderNotesList,
    updateActiveNoteListItem,
    ensureNoteBadgeContextButtons,
    updateNoteBadgeContextButtonsState,
    getCurrentNoteCreationBadgeMask() {
      return noteBadgeFilter === NOTE_BADGE_ALL_FILTER ? 0 : normalizeNoteBadgeMask(noteBadgeFilter);
    },
    getNoteBadgeFilter() {
      return noteBadgeFilter;
    },
    areNoteBadgesVisible() {
      return areNoteBadgesVisible;
    },
    toggleBadgesVisible,
    closeContextMenu,
    isContextMenuOpen() {
      return noteContextMenu?.style.display !== "none";
    },
  };
}
