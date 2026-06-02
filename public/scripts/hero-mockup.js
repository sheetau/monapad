(() => {
  const editorConfig = {
    source: `# Studio Journal

## Recording Session

The piano in the north room had drifted slightly out of tune during the winter, creating a faint resonance that lingered beneath every chord. While reviewing older compositions, several arrangements unexpectedly aligned with notes preserved in https://en.wikipedia.org/wiki/Fugue, despite having been written years apart under entirely different circumstances.

1. Archive unused takes separately.
2. Label revisions immediately after recording.
3. Export backups before closing the session.

-# Reminder: unfinished versions often contain the strongest ideas.

> “Music expresses that which cannot be put into words.”

## Composition Notes

Most revisions involved removing unnecessary layers rather than adding new material. As the arrangement became simpler, smaller imperfections became easier to notice, particularly the subtle timing inconsistencies between repeated phrases near the ending section.

## Session Archive

      One discarded recording captured several minutes of room ambience after the performance had supposedly ended. In the background, faint page-turning sounds could be heard at irregular intervals, despite the studio being completely empty at the time of recording.`,
    padding: { before: 1, after: 5 },
    selectionText: [
      "drifted slightly out of tune",
      "Export backups before closing the session",
      "subtle timing inconsistencies",
    ],
    timing: {
      initialHold: 1600,
      foldStep: 720,
      longHold: 2500,
      headingChar: 72,
      selectChar: 24,
      selectionGap: 420,
      finalSelectionGap: 240,
      cycleGap: 1700,
    },
  };

  const svgNs = "http://www.w3.org/2000/svg";
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectionTextSet = new Set(editorConfig.selectionText);
  const tokenPattern = new RegExp(
    `https?:\\/\\/[^\\s,]+|${editorConfig.selectionText.map(escapeRegExp).join("|")}`,
    "g",
  );

  function createFoldIcon() {
    const svg = document.createElementNS(svgNs, "svg");
    const path = document.createElementNS(svgNs, "path");

    svg.setAttribute("viewBox", "0 0 8 13");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", "M1 12 7 6.5 1 1");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);

    return svg;
  }

  function appendTextSegment(target, text, className = "") {
    if (!text) return;
    if (!className) {
      target.append(text);
      return;
    }

    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    target.append(span);
  }

  function appendSelectionTarget(target, text, lineNumber, column) {
    const selection = document.createElement("span");
    const chars = [...text].map((char) => {
      const charSpan = document.createElement("span");
      charSpan.className = "editor-selection-char";
      charSpan.textContent = char;
      return charSpan;
    });

    selection.className = "editor-selection-target";
    selection.dataset.selectionText = text;
    selection.dataset.editorLine = String(lineNumber);
    selection.dataset.editorColumn = String(column);
    selection.append(...chars);
    target.append(selection);
    return { element: selection, chars };
  }

  function appendEditorText(target, line, state, columnOffset = 0) {
    const listMatch = line.text.match(/^(\d+\.)\s(.+)/);
    if (listMatch) {
      appendTextSegment(target, listMatch[1], "editor-list-marker");
      target.append(" ");
      appendEditorText(target, { ...line, text: listMatch[2] }, state, listMatch[1].length + 1);
      return;
    }

    let cursor = 0;
    line.text.replace(tokenPattern, (match, offset) => {
      appendTextSegment(target, line.text.slice(cursor, offset));
      if (selectionTextSet.has(match)) {
        const selection = appendSelectionTarget(target, match, line.number, columnOffset + offset + 1);
        state.selectionTargets.push({ ...selection, line });
      } else {
        appendTextSegment(target, match, "editor-link");
      }
      cursor = offset + match.length;
      return match;
    });
    appendTextSegment(target, line.text.slice(cursor));
  }

  function appendAnimatedHeading(target, line) {
    const prefix = document.createElement("span");
    const text = document.createElement("span");

    prefix.className = "editor-heading-prefix";
    text.className = "editor-heading-text";
    target.append(prefix, text);
    line.headingAnimation = {
      prefix,
      text,
      value: line.text.replace(/^#+\s*/, ""),
    };
    line.caretTarget = text;
  }

  function getLineMeta(text) {
    const headingMatch = text.match(/^(#{1,6})\s/);
    if (headingMatch) {
      return {
        headingLevel: headingMatch[1].length,
        textClass: headingMatch[1].length === 1 ? "editor-h1" : "editor-h2",
      };
    }
    if (text.startsWith("-# ")) return { textClass: "editor-muted" };
    if (text.startsWith("> ")) return { textClass: "editor-quote" };
    return {};
  }

  function createLines() {
    const rawLines = [
      ...Array.from({ length: editorConfig.padding.before }, () => ({ text: "", padding: "before" })),
      ...editorConfig.source.split("\n").map((text) => ({ text })),
      ...Array.from({ length: editorConfig.padding.after }, () => ({ text: "", padding: "after" })),
    ];
    const lines = rawLines.map((line, index) => ({
      index,
      number: index + 1,
      ...line,
      ...getLineMeta(line.text),
    }));

    lines.forEach((line, index) => {
      if (!line.headingLevel) return;

      const nextHeadingIndex = lines.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex > index && candidate.headingLevel && candidate.headingLevel <= line.headingLevel,
      );
      let endIndex = nextHeadingIndex === -1 ? lines.length - 1 : nextHeadingIndex - 1;
      while (endIndex > index && !lines[endIndex].text.trim()) endIndex -= 1;
      line.foldRange = { start: index + 1, end: endIndex };
    });

    return lines;
  }

  function renderMinimap(lines) {
    const minimap = document.createElement("div");
    minimap.className = "editor-minimap";
    minimap.setAttribute("aria-hidden", "true");

    minimap.append(
      ...lines.map((line) => {
        const previewLine = document.createElement("div");
        const textLength = line.text.trim().length;
        const width = textLength ? Math.min(100, Math.max(14, textLength * 1.2)) : 0;

        previewLine.className = "editor-minimap-line";
        previewLine.style.width = `${width}%`;
        previewLine.classList.toggle("is-empty", !textLength);
        previewLine.classList.toggle("is-h1", line.headingLevel === 1);
        previewLine.classList.toggle("is-h2", line.headingLevel > 1);
        previewLine.classList.toggle("is-muted", line.textClass === "editor-muted");
        return previewLine;
      }),
    );

    return minimap;
  }

  function createCaret(editorCode) {
    const caret = document.createElement("span");
    caret.className = "editor-caret";
    caret.setAttribute("aria-hidden", "true");
    editorCode.append(caret);
    return caret;
  }

  function setCaretPosition(caret, editorCode, rect, align = "end") {
    const editorRect = editorCode.getBoundingClientRect();
    caret.style.left = `${(align === "start" ? rect.left : rect.right) - editorRect.left}px`;
    caret.style.top = `${rect.top - editorRect.top}px`;
    caret.classList.add("is-visible");
  }

  function getLastTextNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node;

    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const textNode = getLastTextNode(node.childNodes[index]);
      if (textNode) return textNode;
    }
    return null;
  }

  function getTextEndRect(line) {
    const target = line.caretTarget ?? line.contentRow;
    const textNode = getLastTextNode(target);
    if (!textNode) return line.contentRow.getBoundingClientRect();

    const range = document.createRange();
    range.setStart(textNode, textNode.textContent.length);
    range.setEnd(textNode, textNode.textContent.length);
    let rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    range.detach();

    if (!rect.width && !rect.height) {
      const fallbackRange = document.createRange();
      fallbackRange.setStart(textNode, Math.max(0, textNode.textContent.length - 1));
      fallbackRange.setEnd(textNode, textNode.textContent.length);
      rect = fallbackRange.getBoundingClientRect();
      fallbackRange.detach();
    }

    return rect.width || rect.height ? rect : line.contentRow.getBoundingClientRect();
  }

  function renderEditor(container) {
    const lines = createLines();
    const state = {
      lines,
      selectionTargets: [],
      gutterRows: [],
      contentRows: [],
      manualFoldLineIndexes: new Set(),
      foldAnimationStopped: false,
      headingAnimationDone: false,
      resizeFrame: 0,
      caretSyncFrame: 0,
    };
    const gutterColumn = document.createElement("div");
    const contentColumn = document.createElement("div");

    gutterColumn.className = "editor-gutter";
    contentColumn.className = "editor-content";

    lines.forEach((line) => {
      const gutterRow = document.createElement("div");
      const contentRow = document.createElement("div");
      const lineNumber = document.createElement("span");
      const foldSlot = document.createElement("span");

      gutterRow.className = "editor-gutter-line";
      contentRow.className = `editor-content-line editor-text${line.textClass ? ` ${line.textClass}` : ""}`;
      if (line.headingLevel === 1) contentRow.classList.remove("editor-h1");
      gutterRow.dataset.editorLine = String(line.number);
      contentRow.dataset.editorLine = String(line.number);
      contentRow.dataset.editorText = line.text;
      if (line.padding) {
        gutterRow.dataset.editorPadding = line.padding;
        contentRow.dataset.editorPadding = line.padding;
      }
      if (!line.text.trim()) {
        gutterRow.dataset.editorEmpty = "true";
        contentRow.dataset.editorEmpty = "true";
      }

      lineNumber.className = "editor-line-number";
      lineNumber.textContent = String(line.number);
      foldSlot.className = "editor-fold-slot";
      line.gutterRow = gutterRow;
      line.contentRow = contentRow;

      if (line.headingLevel) {
        const button = document.createElement("button");
        gutterRow.dataset.editorHeading = String(line.headingLevel);
        contentRow.dataset.editorHeading = String(line.headingLevel);
        button.className = "editor-fold-button";
        button.type = "button";
        button.setAttribute("aria-label", `Fold ${line.text.replace(/^#+\s*/, "")}`);
        button.setAttribute("aria-expanded", "true");
        button.append(createFoldIcon());
        foldSlot.append(button);
        line.foldButton = button;
        if (line.headingLevel === 1) {
          button.disabled = true;
          gutterRow.classList.add("is-fold-disabled");
        }
      }

      if (line.headingLevel === 1) {
        appendAnimatedHeading(contentRow, line);
      } else {
        appendEditorText(contentRow, line, state);
      }
      gutterRow.append(lineNumber, foldSlot);
      gutterColumn.append(gutterRow);
      contentColumn.append(contentRow);
      state.gutterRows.push(gutterRow);
      state.contentRows.push(contentRow);
    });

    container.replaceChildren(gutterColumn, contentColumn);
    container.closest(".editor-canvas")?.querySelector(".editor-minimap")?.remove();
    container.closest(".editor-canvas")?.append(renderMinimap(lines));
    state.gutter = gutterColumn;
    return state;
  }

  function initEditorMockup() {
    const editorCode = document.querySelector("[data-editor-code]");
    if (!editorCode) return;

    const state = renderEditor(editorCode);
    const headingLine = state.lines.find((line) => line.headingLevel === 1);
    const carets = state.selectionTargets.map(() => createCaret(editorCode));
    const caretAnchors = new Map();
    const timing = editorConfig.timing;
    const positionStatus = document.querySelector("[data-editor-position-status]");
    const h2Lines = state.lines.filter((line) => line.headingLevel === 2).slice(-2);

    window.monapadHeroEditor = state;

    const activityResolvers = new Set();
    let isEditorInView = false;
    let isDocumentVisible = !document.hidden;
    let shouldBlinkCarets = false;
    const isActive = () => isEditorInView && isDocumentVisible;
    const syncCaretBlinking = () => {
      editorCode.classList.toggle("is-caret-blinking", shouldBlinkCarets && isActive());
    };
    const notifyActivityChange = () => {
      activityResolvers.forEach((resolve) => resolve());
      activityResolvers.clear();
      syncCaretBlinking();
    };
    const waitForActivityChange = () => new Promise((resolve) => activityResolvers.add(resolve));
    const waitForActive = async () => {
      while (!isActive()) await waitForActivityChange();
    };
    const wait = async (ms) => {
      let remaining = ms;

      while (remaining > 0) {
        await waitForActive();
        const startedAt = performance.now();
        let timedOut = false;
        let timeoutId = 0;

        await Promise.race([
          new Promise(
            (resolve) =>
              (timeoutId = setTimeout(() => {
                timedOut = true;
                resolve();
              }, remaining)),
          ),
          waitForActivityChange(),
        ]);
        if (!timedOut) clearTimeout(timeoutId);

        remaining = timedOut ? 0 : remaining - (performance.now() - startedAt);
      }
    };
    const scheduleLayoutSync = () => {
      if (state.resizeFrame) return;
      state.resizeFrame = window.requestAnimationFrame(() => {
        state.resizeFrame = 0;
        state.lines.forEach((line) => {
          line.gutterRow.style.minHeight = `${line.contentRow.getBoundingClientRect().height}px`;
        });
        scheduleCaretSync();
      });
    };
    const scheduleCaretSync = () => {
      if (state.caretSyncFrame) return;
      state.caretSyncFrame = window.requestAnimationFrame(() => {
        state.caretSyncFrame = 0;
        syncCarets();
      });
    };
    const setCaretsBlinking = (shouldBlink, shouldReset = false) => {
      shouldBlinkCarets = shouldBlink;
      if (!shouldBlink) {
        editorCode.classList.remove("is-caret-blinking");
        return;
      }
      if (!isActive()) {
        editorCode.classList.remove("is-caret-blinking");
        return;
      }
      if (shouldReset) {
        editorCode.classList.remove("is-caret-blinking");
        editorCode.offsetHeight;
      }
      syncCaretBlinking();
    };
    const hideCaret = (caret) => caret.classList.remove("is-visible");
    const hideUnusedCarets = (startIndex = 1) => {
      carets.slice(startIndex).forEach((caret) => {
        hideCaret(caret);
        caretAnchors.delete(caret);
      });
    };
    const moveAnchoredCaret = (caret, anchor) => {
      if (anchor.line?.contentRow.classList.contains("is-hidden")) {
        hideCaret(caret);
        return;
      }
      setCaretPosition(caret, editorCode, anchor.getRect(), anchor.align);
    };
    const setCaretAnchor = (index, anchor) => {
      const caret = carets[index];
      if (!caret) return;

      caretAnchors.set(caret, anchor);
      moveAnchoredCaret(caret, anchor);
    };
    const syncCarets = () => caretAnchors.forEach((anchor, caret) => moveAnchoredCaret(caret, anchor));
    const resetCaretsToHeading = () => {
      hideUnusedCarets(1);
      setCaretAnchor(0, {
        align: "end",
        line: headingLine,
        getRect: () => getTextEndRect(headingLine),
      });
    };
    const setStatus = (selectionState = null) => {
      if (!positionStatus) return;
      if (selectionState?.count > 1) {
        positionStatus.textContent = `${selectionState.count} selections (${selectionState.selected} selected)`;
        return;
      }
      if (selectionState?.count === 1) {
        positionStatus.textContent = `Ln ${selectionState.line}, Col ${selectionState.column} (${selectionState.selected} selected)`;
        return;
      }
      positionStatus.textContent = `Ln ${headingLine?.number ?? 2}, Col ${(headingLine?.text.length ?? 16) + 1}`;
    };
    const clearSelections = () =>
      state.selectionTargets.forEach((target) => target.chars.forEach((char) => char.classList.remove("is-selected")));
    const resetSelectionAnimation = () => {
      clearSelections();
      setStatus();
      resetCaretsToHeading();
      setCaretsBlinking(true);
    };
    const runHeadingAnimation = async () => {
      const headingAnimation = headingLine?.headingAnimation;
      if (!headingAnimation || state.headingAnimationDone) return;

      headingAnimation.prefix.textContent = "";
      headingAnimation.text.textContent = "";
      headingLine.contentRow.classList.remove("editor-h1");
      resetCaretsToHeading();
      setStatus();
      setCaretsBlinking(false);

      for (const char of headingAnimation.value) {
        headingAnimation.text.textContent += char;
        syncCarets();
        await wait(timing.headingChar);
      }

      setCaretsBlinking(true, true);
      await wait(timing.selectionGap);
      headingAnimation.prefix.textContent = "# ";
      headingLine.contentRow.classList.add("editor-h1");
      headingLine.gutterRow.classList.remove("is-fold-disabled");
      if (headingLine.foldButton) headingLine.foldButton.disabled = false;
      state.headingAnimationDone = true;
      syncCarets();
      scheduleLayoutSync();
    };
    const getSelectionState = (activeTarget = null) => {
      const selectedTargets = state.selectionTargets.filter((target) => target.element.querySelector(".is-selected"));
      if (selectedTargets.length === 1) {
        const target = activeTarget ?? selectedTargets[0];
        const selected = target.chars.filter((char) => char.classList.contains("is-selected")).length;
        return {
          count: 1,
          selected,
          line: Number(target.element.dataset.editorLine),
          column: Number(target.element.dataset.editorColumn) + selected,
        };
      }
      return {
        count: selectedTargets.length,
        selected: selectedTargets.reduce(
          (total, target) => total + target.chars.filter((char) => char.classList.contains("is-selected")).length,
          0,
        ),
      };
    };
    const updateFoldVisibility = () => {
      const hiddenLineIndexes = new Set();

      state.lines.forEach((line) => {
        if (!line.foldRange || !line.contentRow.classList.contains("is-folded")) return;
        for (let index = line.foldRange.start; index <= line.foldRange.end; index += 1) hiddenLineIndexes.add(index);
      });
      state.lines.forEach((line) => {
        const shouldHide = hiddenLineIndexes.has(line.index);
        line.gutterRow.classList.toggle("is-hidden", shouldHide);
        line.contentRow.classList.toggle("is-hidden", shouldHide);
      });
    };
    const toggleFoldLine = (line, shouldFold) => {
      line.gutterRow.classList.toggle("is-folded", shouldFold);
      line.contentRow.classList.toggle("is-folded", shouldFold);
      line.foldButton?.setAttribute("aria-expanded", String(!shouldFold));
      updateFoldVisibility();
      scheduleLayoutSync();
      syncCarets();
    };
    const isAllFoldsOpen = () => state.lines.every((line) => !line.contentRow.classList.contains("is-folded"));

    state.toggleFoldLine = toggleFoldLine;
    state.updateFoldVisibility = updateFoldVisibility;
    state.syncGutterHeights = scheduleLayoutSync;
    state.syncCaretFoldVisibility = scheduleCaretSync;

    state.lines.forEach((line) => {
      line.foldButton?.addEventListener("click", () => {
        if (line.foldButton.disabled) return;
        state.foldAnimationStopped = true;
        state.manualFoldLineIndexes.add(line.index);
        toggleFoldLine(line, !line.contentRow.classList.contains("is-folded"));
      });
    });

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(scheduleLayoutSync);
      state.lines.forEach((line) => resizeObserver.observe(line.contentRow));
      state.resizeObserver = resizeObserver;
    }
    if (window.IntersectionObserver) {
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          isEditorInView = entry.isIntersecting;
          notifyActivityChange();
        },
        { threshold: 0 },
      );
      visibilityObserver.observe(editorCode.closest(".editor-mockup") ?? editorCode);
      state.visibilityObserver = visibilityObserver;
    } else {
      isEditorInView = true;
    }
    document.addEventListener("visibilitychange", () => {
      isDocumentVisible = !document.hidden;
      notifyActivityChange();
    });

    async function runFoldAnimation() {
      if (state.foldAnimationStopped || h2Lines.length < 2) return false;

      const animatedFoldLines = [];
      const canContinue = () => !state.foldAnimationStopped;
      const cleanupAnimatedFolds = () => {
        animatedFoldLines.forEach((line) => {
          if (!state.manualFoldLineIndexes.has(line.index)) toggleFoldLine(line, false);
        });
      };
      const stopFoldAnimation = () => {
        cleanupAnimatedFolds();
        state.gutter.classList.remove("is-fold-hover");
        return false;
      };
      const foldAnimatedLine = (line) => {
        animatedFoldLines.push(line);
        toggleFoldLine(line, true);
      };

      state.manualFoldLineIndexes.clear();
      state.gutter.classList.add("is-fold-hover");
      await wait(timing.foldStep);
      if (!canContinue()) return stopFoldAnimation();

      foldAnimatedLine(h2Lines[0]);
      await wait(timing.foldStep);
      if (!canContinue()) return stopFoldAnimation();

      foldAnimatedLine(h2Lines[1]);
      await wait(timing.longHold);
      if (!canContinue()) return stopFoldAnimation();

      cleanupAnimatedFolds();
      state.gutter.classList.remove("is-fold-hover");
      resetSelectionAnimation();
      return true;
    }

    async function runSelectionAnimation() {
      await (document.fonts?.ready ?? Promise.resolve());
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const sampleRect = state.selectionTargets[0]?.chars[0]?.getBoundingClientRect();
      if (sampleRect) editorCode.style.setProperty("--editor-caret-height", `${sampleRect.height}px`);

      await runHeadingAnimation();
      resetSelectionAnimation();
      setCaretsBlinking(true, true);
      await wait(timing.initialHold);

      while (true) {
        for (const [targetIndex, target] of state.selectionTargets.entries()) {
          hideUnusedCarets(targetIndex + 1);
          setCaretsBlinking(false);
          setCaretAnchor(targetIndex, {
            align: "start",
            line: target.line,
            getRect: () => target.chars[0].getBoundingClientRect(),
          });

          for (const char of target.chars) {
            char.classList.add("is-selected");
            setCaretAnchor(targetIndex, {
              align: "end",
              line: target.line,
              getRect: () => char.getBoundingClientRect(),
            });
            setStatus(getSelectionState(target));
            await wait(timing.selectChar);
          }

          setCaretsBlinking(true, true);
          const isLastTarget = targetIndex === state.selectionTargets.length - 1;
          await wait(
            isLastTarget
              ? state.foldAnimationStopped
                ? timing.longHold
                : timing.finalSelectionGap
              : timing.selectionGap,
          );
        }

        if (state.foldAnimationStopped) {
          resetSelectionAnimation();
          if (isAllFoldsOpen()) state.foldAnimationStopped = false;
        } else {
          const foldCompleted = await runFoldAnimation();
          if (!foldCompleted) {
            await wait(timing.longHold);
            resetSelectionAnimation();
            if (isAllFoldsOpen()) state.foldAnimationStopped = false;
          }
        }
        await wait(timing.cycleGap);
      }
    }

    scheduleLayoutSync();
    notifyActivityChange();
    runSelectionAnimation();
  }

  const initWhenReady = () => {
    initEditorMockup();
  };
  if (document.readyState === "complete") {
    initWhenReady();
  } else {
    window.addEventListener("load", initWhenReady, { once: true });
  }
})();
