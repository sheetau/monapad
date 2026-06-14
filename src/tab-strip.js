export const TAB_LAYOUT_ANIMATION_MS = 200;
export const TAB_LAYOUT_EASING = "cubic-bezier(0.333333, 0.666667, 0.666667, 1)";
export const TAB_MAX_WIDTH = 220;
export const TAB_MIN_WIDTH = 0;
export const TAB_VERTICAL_DETACH_MAGNETISM = 15;

export function createTabStripController({
  tabs,
  tabsContainer,
  addTabButton,
  getTabData,
  getDraggingTab,
  getDraggingTabData,
  setCurrentX,
  getPinnedTabCount,
}) {
  let closingTabSlots = [];
  let tabLayoutAnimations = new Map();
  let tabsWidthAnimation = null;
  let tabClosingModeAvailableWidth = null;
  let tabDragExtendedWidth = null;
  let pendingTabsResizeLayout = false;
  let lastObservedAvailableWidth = null;

  function getTabElements(excludeTab = null) {
    return getTabData().map((tab) => tab.element).filter((tab) => tab !== excludeTab);
  }

  function getAddTabOuterWidth() {
    const rect = addTabButton.getBoundingClientRect();
    const style = getComputedStyle(addTabButton);
    return rect.width + parseFloat(style.marginLeft || "0") + parseFloat(style.marginRight || "0");
  }

  function getTabDropPlacementByClientX(clientX, excludeTab = null) {
    const tabElements = getTabElements(excludeTab);
    const tabsRect = tabs.getBoundingClientRect();
    if (!tabElements.length) return { index: 0, left: 0, referenceTab: null };

    const tabData = getTabData();
    const rects = tabElements.map((tabElement) => {
      const tab = tabData.find((candidate) => candidate.element === tabElement);
      const bounds = tab?._tabBounds || getCurrentTabBounds(tab);
      return {
        left: tabsRect.left + bounds.x,
        right: tabsRect.left + bounds.x + bounds.width,
        width: bounds.width,
      };
    });
    const firstRect = rects[0];
    const lastRect = rects[rects.length - 1];

    if (clientX < firstRect.left) {
      return { index: 0, left: Math.max(0, firstRect.left - tabsRect.left), referenceTab: tabElements[0] };
    }
    if (clientX > lastRect.right) {
      return {
        index: tabElements.length,
        left: Math.max(0, lastRect.right - tabsRect.left),
        referenceTab: null,
      };
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

    return { index: tabElements.length, left: Math.max(0, lastRect.right - tabsRect.left), referenceTab: null };
  }

  function clampDropPlacementAfterPinnedTabs(placement, excludeTab = null) {
    const pinnedCount = getPinnedTabCount();
    if (!placement || placement.index === null || placement.index >= pinnedCount) return placement;

    const tabElements = getTabElements(excludeTab);
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

    const tabData = getTabData();
    const tabElements = getTabElements(excludeTab);
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

  function getAvailableWidthForTabs(options = {}) {
    const { ignoreClosingMode = false } = options;
    if (!ignoreClosingMode && tabClosingModeAvailableWidth !== null) return tabClosingModeAvailableWidth;
    const maxWidth = parseFloat(getComputedStyle(tabsContainer).maxWidth);
    const containerLimit = Number.isFinite(maxWidth) ? maxWidth : tabsContainer.getBoundingClientRect().width;
    return Math.max(0, containerLimit - getAddTabOuterWidth());
  }

  function getTabStripAvailableDragWidth() {
    return getAvailableWidthForTabs({ ignoreClosingMode: true });
  }

  function isTabLayoutAnimating() {
    return Boolean(tabsWidthAnimation) || tabLayoutAnimations.size > 0;
  }

  function getTabDragAreaWidth() {
    return getTabStripAvailableDragWidth();
  }

  function getTabLayoutSlots() {
    const slots = getTabData().map((tab, index) => ({ tab, closing: false, index }));
    for (const closingSlot of closingTabSlots) {
      const index = Math.max(0, Math.min(closingSlot.index, slots.length));
      slots.splice(index, 0, closingSlot);
    }
    return slots;
  }

  function getTabsIdealTrailingX() {
    let trailingX = 0;
    for (const slot of getTabLayoutSlots()) {
      const bounds = slot.tab?._tabBounds;
      if (!bounds) continue;
      trailingX = Math.max(trailingX, bounds.x + bounds.width);
    }
    return trailingX;
  }

  function getLocalTabDragAreaRect() {
    const rect = tabsContainer.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.left + getTabDragAreaWidth(),
      top: rect.top,
      bottom: rect.bottom,
    };
  }

  function isPointInLocalTabDragArea(clientX, clientY, dragRect = getLocalTabDragAreaRect()) {
    return (
      clientX >= dragRect.left &&
      clientX <= dragRect.right &&
      clientY >= dragRect.top - TAB_VERTICAL_DETACH_MAGNETISM &&
      clientY <= dragRect.bottom + TAB_VERTICAL_DETACH_MAGNETISM
    );
  }

  function isOutsideTabDragContext(clientX, clientY) {
    return !isPointInLocalTabDragArea(clientX, clientY);
  }

  function calculateTabLayout(slots, availableWidth) {
    const openSlots = slots.filter((slot) => !slot.closing);
    const openCount = openSlots.length;
    let openWidth = openCount ? Math.min(TAB_MAX_WIDTH, Math.floor(availableWidth / openCount)) : 0;
    openWidth = Math.max(0, openWidth);
    if (openCount && openWidth < TAB_MIN_WIDTH) openWidth = TAB_MIN_WIDTH;

    let extraPixels = openCount ? Math.max(0, Math.min(availableWidth, openCount * TAB_MAX_WIDTH) - openWidth * openCount) : 0;
    let x = 0;
    const bounds = new Map();

    for (const slot of slots) {
      let width = 0;
      if (!slot.closing) {
        width = openWidth;
        if (extraPixels > 0 && width < TAB_MAX_WIDTH) {
          width += 1;
          extraPixels -= 1;
        }
      }
      bounds.set(slot.tab, { x, width });
      x += width;
    }

    return { bounds, trailingX: x, compact: openWidth <= 60 };
  }

  function setTabBounds(tab, bounds) {
    tab._tabBounds = bounds;
    tab.element.style.left = `${bounds.x}px`;
    tab.element.style.width = `${bounds.width}px`;
  }

  function getCurrentTabBounds(tab) {
    const rect = tab.element.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    if (tab.element.isConnected && (rect.width > 0 || rect.left !== 0)) {
      return { x: rect.left - tabsRect.left, width: rect.width };
    }
    if (tab._tabBounds) return { ...tab._tabBounds };
    return { x: rect.left - tabsRect.left, width: rect.width };
  }

  function setSkippedTabBounds(tab, target) {
    const draggingTab = getDraggingTab();
    const draggingTabData = getDraggingTabData();
    if (tab === draggingTabData && draggingTab === tab.element) {
      const rect = draggingTab.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const visualX = rect.left - tabsRect.left;
      setTabBounds(tab, target);
      const nextCurrentX = visualX - target.x;
      setCurrentX(nextCurrentX);
      draggingTab.style.setProperty("--tab-drag-x", `${nextCurrentX}px`);
      return;
    }
    tab._tabBounds = target;
  }

  function finishTabLayoutAnimations() {
    for (const animation of tabLayoutAnimations.values()) {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    }
    tabLayoutAnimations.clear();
    if (tabsWidthAnimation) {
      try {
        tabsWidthAnimation.finish();
      } catch {
        tabsWidthAnimation.cancel();
      }
      tabsWidthAnimation = null;
    }
  }

  function cancelTabLayoutAnimation(tab) {
    const animation = tabLayoutAnimations.get(tab);
    if (!animation) return;
    animation.cancel();
    tabLayoutAnimations.delete(tab);
  }

  function animateTabsWidth(targetWidth, animate) {
    if (tabDragExtendedWidth !== null) {
      targetWidth = Math.max(targetWidth, tabDragExtendedWidth);
    }
    const currentWidth = tabs.getBoundingClientRect().width;
    if (tabsWidthAnimation) {
      tabsWidthAnimation.cancel();
      tabsWidthAnimation = null;
    }
    tabs.style.width = `${targetWidth}px`;
    if (!animate || Math.abs(currentWidth - targetWidth) < 0.5) return Promise.resolve();

    const animation = tabs.animate(
      [{ width: `${currentWidth}px` }, { width: `${targetWidth}px` }],
      { duration: TAB_LAYOUT_ANIMATION_MS, easing: TAB_LAYOUT_EASING },
    );
    tabsWidthAnimation = animation;
    return animation.finished.catch(() => {}).finally(() => {
      if (tabsWidthAnimation !== animation) return;
      tabsWidthAnimation = null;
      tabs.style.width = `${targetWidth}px`;
    });
  }

  function getOpeningTabStartBounds(tab, target) {
    const index = getTabData().indexOf(tab);
    if (index > 0) {
      const previousTab = getTabData()[index - 1];
      const previousBounds = getCurrentTabBounds(previousTab);
      return { x: previousBounds.x + previousBounds.width, width: 0 };
    }

    const nextTab = getTabData()[index + 1];
    if (nextTab) {
      const nextBounds = getCurrentTabBounds(nextTab);
      return { x: nextBounds.x, width: 0 };
    }

    return { x: target.x, width: target.width };
  }

  function animateTabBounds(tab, from, to, animate) {
    const existing = tabLayoutAnimations.get(tab);
    if (existing) {
      existing.cancel();
      tabLayoutAnimations.delete(tab);
    }

    setTabBounds(tab, to);
    if (!animate || (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.width - to.width) < 0.5)) {
      return Promise.resolve();
    }

    const animation = tab.element.animate(
      [
        { left: `${from.x}px`, width: `${from.width}px` },
        { left: `${to.x}px`, width: `${to.width}px` },
      ],
      { duration: TAB_LAYOUT_ANIMATION_MS, easing: TAB_LAYOUT_EASING },
    );
    tabLayoutAnimations.set(tab, animation);
    return animation.finished.catch(() => {}).finally(() => {
      if (tabLayoutAnimations.get(tab) !== animation) return;
      tabLayoutAnimations.delete(tab);
      setTabBounds(tab, to);
    });
  }

  function layoutTabs(options = {}) {
    const { animate = true, openingTab = null, skipTabs = new Set(), onComplete = null } = options;
    const slots = getTabLayoutSlots();
    const { bounds, trailingX, compact } = calculateTabLayout(slots, getAvailableWidthForTabs());
    const animations = [animateTabsWidth(trailingX, animate)];

    tabs.classList.toggle("compact", compact);

    for (const slot of slots) {
      const tab = slot.tab;
      const target = bounds.get(tab);
      if (!target) continue;

      const isOpening = tab === openingTab;
      const from = isOpening ? getOpeningTabStartBounds(tab, target) : getCurrentTabBounds(tab);
      if (skipTabs.has(tab)) {
        setSkippedTabBounds(tab, target);
        continue;
      }
      animations.push(animateTabBounds(tab, from, target, animate));
      if (slot.closing && animate) scheduleClosingTabCleanup(tab);
    }

    const finished = Promise.all(animations).then(() => {
      onComplete?.();
      if (!isTabLayoutAnimating() && pendingTabsResizeLayout) {
        pendingTabsResizeLayout = false;
        tabClosingModeAvailableWidth = null;
        layoutTabs({ animate: false });
      }
    });
    return finished;
  }

  function updateTabsCompactClass() {
    const slots = getTabLayoutSlots();
    const { compact } = calculateTabLayout(slots, getAvailableWidthForTabs());
    tabs.classList.toggle("compact", compact);
  }

  function enterTabClosingMode(overrideWidth = null) {
    tabClosingModeAvailableWidth = overrideWidth ?? tabs.getBoundingClientRect().width;
  }

  function exitTabClosingMode() {
    tabClosingModeAvailableWidth = null;
    layoutTabs({ animate: true });
  }

  function maybeExitTabClosingModeAfterClose() {
    if (tabClosingModeAvailableWidth === null) return;
    const { trailingX } = calculateTabLayout(getTabLayoutSlots(), tabClosingModeAvailableWidth);
    if (getTabData().length > 0 && tabClosingModeAvailableWidth > trailingX) {
      tabClosingModeAvailableWidth = null;
    }
  }

  function removeClosingTabSlot(slot) {
    closingTabSlots = closingTabSlots.filter((candidate) => candidate !== slot);
    const tab = slot.tab;
    if (tab._closingCleanupTimer) {
      clearTimeout(tab._closingCleanupTimer);
      tab._closingCleanupTimer = null;
    }
    tab._closingSlot = null;
    tab.element.classList.remove("closing");
    if (tab.element.parentElement === tabs) tabs.removeChild(tab.element);
    if (tab.model) tab.model.dispose();
    updateTabsCompactClass();
  }

  function scheduleClosingTabCleanup(tab) {
    const slot = tab._closingSlot;
    if (!slot) return;
    if (tab._closingCleanupTimer) clearTimeout(tab._closingCleanupTimer);
    tab._closingCleanupTimer = setTimeout(() => {
      tab._closingCleanupTimer = null;
      tab._closing = false;
      tab._closingSlot = null;
      removeClosingTabSlot(slot);
      layoutTabs({ animate: false });
    }, TAB_LAYOUT_ANIMATION_MS);
  }

  function addClosingTabSlot(tab, index) {
    const closingSlot = { tab, closing: true, index };
    tab._closingSlot = closingSlot;
    closingTabSlots.push(closingSlot);
    return closingSlot;
  }

  function setTabClosingModeAvailableWidth(width) {
    tabClosingModeAvailableWidth = width;
  }

  function clearTabClosingModeAvailableWidth() {
    tabClosingModeAvailableWidth = null;
  }

  function setTabDragExtendedWidth(width) {
    tabDragExtendedWidth = width;
  }

  function updateTabsWidthForDraggedTab(dragVisualX) {
    const draggingTab = getDraggingTab();
    const draggingTabData = getDraggingTabData();
    if (!draggingTab || dragVisualX === null) return;
    const draggingWidth = draggingTab.getBoundingClientRect().width || draggingTabData?._tabBounds?.width || 0;
    const targetWidth = Math.min(
      getTabStripAvailableDragWidth(),
      Math.max(getTabsIdealTrailingX(), dragVisualX + draggingWidth),
    );
    tabDragExtendedWidth = targetWidth;
    if (tabsWidthAnimation) {
      tabsWidthAnimation.cancel();
      tabsWidthAnimation = null;
    }
    tabs.style.width = `${targetWidth}px`;
  }

  function observeTabsResize() {
    const tabsResizeObserver = new ResizeObserver(() => {
      if (!tabs.isConnected) return;
      const availableWidth = getAvailableWidthForTabs({ ignoreClosingMode: true });
      if (lastObservedAvailableWidth === null) {
        lastObservedAvailableWidth = availableWidth;
        return;
      }
      if (Math.abs(availableWidth - lastObservedAvailableWidth) < 0.5) return;
      lastObservedAvailableWidth = availableWidth;
      if (isTabLayoutAnimating()) {
        pendingTabsResizeLayout = true;
        return;
      }
      tabClosingModeAvailableWidth = null;
      layoutTabs({ animate: false });
    });
    tabsResizeObserver.observe(tabsContainer);
    return tabsResizeObserver;
  }

  return {
    addClosingTabSlot,
    calculateTabLayout,
    cancelTabLayoutAnimation,
    clampDropPlacementAfterPinnedTabs,
    clampDropPlacementForTab,
    clearTabClosingModeAvailableWidth,
    enterTabClosingMode,
    exitTabClosingMode,
    finishTabLayoutAnimations,
    getAvailableWidthForTabs,
    getCurrentTabBounds,
    getTabDragAreaWidth,
    getTabDropPlacementByClientX,
    getTabLayoutSlots,
    getTabStripAvailableDragWidth,
    getTabsIdealTrailingX,
    isOutsideTabDragContext,
    isPointInLocalTabDragArea,
    isTabLayoutAnimating,
    layoutTabs,
    maybeExitTabClosingModeAfterClose,
    observeTabsResize,
    scheduleClosingTabCleanup,
    setTabBounds,
    setTabClosingModeAvailableWidth,
    setTabDragExtendedWidth,
    updateTabsCompactClass,
    updateTabsWidthForDraggedTab,
  };
}
