import { OPEN_FENCE, CLOSE_FENCE } from "./monapad-structure.js";

// Each editor owns its input handlers, viewport decorations and scan caches.
export function installEditorBehavior(monaco, monacoEditor, api) {
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

  let kuromojiEnabled = api.settings.kuromojiEnabled;

  const setKuromojiEnabled = (val) => {
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
    if (del && monacoEditor.getOption(monaco.editor.EditorOption.readOnly)) return;
    const model = monacoEditor.getModel();
    if (!model) return;
    const selections = monacoEditor.getSelections();
    const version = model.getVersionId();
    const valid = () => !model.isDisposed() && monacoEditor.getModel() === model &&
      model.getVersionId() === version && JSON.stringify(monacoEditor.getSelections()) === JSON.stringify(selections);

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

      if (edits.length && valid() && !monacoEditor.getOption(monaco.editor.EditorOption.readOnly)) {
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

    if (valid()) monacoEditor.setSelections(newSelections);
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

    const version = model.getVersionId();
    const initialSelection = JSON.stringify(monacoEditor.getSelection());
    getWordRange(lineText, col0).then(({ start, end }) => {
      const cur = monacoEditor.getSelection();
      if (!model.isDisposed() && monacoEditor.getModel() === model && model.getVersionId() === version && JSON.stringify(cur) === initialSelection) {
        monacoEditor.setSelection(new monaco.Range(pos.lineNumber, start + 1, pos.lineNumber, end + 1));
      }
    });
  });

let currentDecorations = [];
let decorationFrameId = null;
const DECORATION_BUFFER_LINES = 100;
const CODE_BLOCK_CHECKPOINT_LINES = 500;
const DECORATION_MATCHERS = [/^#\s[^#]/, /^##\s[^#]/, /^###\s[^#]/, /^-#\s[^#]/, /^>\s/];
let decorationCoverage = { model: null, versionId: null, ranges: [] };
let codeBlockCheckpointModel = null;
let codeBlockCheckpointVersion = null;
let codeBlockCheckpoints = new Map([[1, false]]);

function mergeLineRanges(ranges) {
  const sortedRanges = ranges.slice().sort((a, b) => a.startLineNumber - b.startLineNumber);
  const mergedRanges = [];

  for (const range of sortedRanges) {
    const lastRange = mergedRanges.at(-1);
    if (!lastRange || range.startLineNumber > lastRange.endLineNumber + 1) {
      mergedRanges.push({ ...range });
      continue;
    }

    lastRange.endLineNumber = Math.max(lastRange.endLineNumber, range.endLineNumber);
  }

  return mergedRanges;
}

function getVisibleLineRanges(model) {
  const lineCount = model.getLineCount();
  return mergeLineRanges(
    monacoEditor.getVisibleRanges().map((range) => ({
      startLineNumber: Math.max(1, Math.min(lineCount, range.startLineNumber)),
      endLineNumber: Math.max(1, Math.min(lineCount, range.endLineNumber)),
    })),
  );
}

function getDecorationLineRanges(model, visibleRanges) {
  const lineCount = model.getLineCount();

  return mergeLineRanges(
    visibleRanges.map((range) => ({
      startLineNumber: Math.max(1, range.startLineNumber - DECORATION_BUFFER_LINES),
      endLineNumber: Math.min(lineCount, range.endLineNumber + DECORATION_BUFFER_LINES),
    })),
  );
}

function areLineRangesCovered(visibleRanges, coveredRanges) {
  return visibleRanges.every((visibleRange) =>
    coveredRanges.some(
      (coveredRange) =>
        coveredRange.startLineNumber <= visibleRange.startLineNumber &&
        coveredRange.endLineNumber >= visibleRange.endLineNumber,
    ),
  );
}

function resetDecorationCoverage() {
  decorationCoverage = { model: null, versionId: null, ranges: [] };
}

function resetCodeBlockCheckpoints(model) {
  codeBlockCheckpointModel = model;
  codeBlockCheckpointVersion = model?.getVersionId?.() ?? null;
  codeBlockCheckpoints = new Map([[1, false]]);
}

function invalidateCodeBlockCheckpoints(model, fromLineNumber) {
  if (!model || codeBlockCheckpointModel !== model) return;
  codeBlockCheckpointVersion = model.getVersionId();
  for (const lineNumber of codeBlockCheckpoints.keys()) {
    if (lineNumber > fromLineNumber) codeBlockCheckpoints.delete(lineNumber);
  }
}

function isInsideCodeBlockBeforeLine(model, lineNumber) {
  const versionId = model.getVersionId();
  if (codeBlockCheckpointModel !== model || codeBlockCheckpointVersion !== versionId) {
    resetCodeBlockCheckpoints(model);
  }

  let checkpointLine = Math.floor((lineNumber - 1) / CODE_BLOCK_CHECKPOINT_LINES) * CODE_BLOCK_CHECKPOINT_LINES + 1;
  while (checkpointLine > 1 && !codeBlockCheckpoints.has(checkpointLine)) {
    checkpointLine -= CODE_BLOCK_CHECKPOINT_LINES;
  }

  let insideCodeBlock = codeBlockCheckpoints.get(checkpointLine) || false;

  for (let i = checkpointLine; i < lineNumber; i++) {
    const trimmed = model.getLineContent(i).trimStart();
    if ((insideCodeBlock ? CLOSE_FENCE : OPEN_FENCE).test(trimmed)) {
      insideCodeBlock = !insideCodeBlock;
    }
    const nextLine = i + 1;
    if ((nextLine - 1) % CODE_BLOCK_CHECKPOINT_LINES === 0) {
      codeBlockCheckpoints.set(nextLine, insideCodeBlock);
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

  if (!api.settings.syntaxHighlight) {
    currentDecorations = monacoEditor.deltaDecorations(currentDecorations, []);
    resetDecorationCoverage();
    return;
  }

  const decorations = [];

  if (model.getLanguageId() !== "monapad") {
    currentDecorations = monacoEditor.deltaDecorations(currentDecorations, []);
    resetDecorationCoverage();
    return;
  }

  const visibleRanges = getVisibleLineRanges(model);
  if (!visibleRanges.length) return;

  const versionId = model.getVersionId();
  if (
    decorationCoverage.model === model &&
    decorationCoverage.versionId === versionId &&
    areLineRangesCovered(visibleRanges, decorationCoverage.ranges)
  ) {
    return;
  }

  const lineRanges = getDecorationLineRanges(model, visibleRanges);

  for (const range of lineRanges) {
    let insideCodeBlock = isInsideCodeBlockBeforeLine(model, range.startLineNumber);

    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
      const line = model.getLineContent(lineNumber);
      const trimmed = line.trimStart();
      const leadingSpaces = line.length - trimmed.length;

      if ((insideCodeBlock ? CLOSE_FENCE : OPEN_FENCE).test(trimmed)) {
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
  decorationCoverage = { model, versionId, ranges: lineRanges };
}

function scheduleApplyDecorations() {
  if (decorationFrameId !== null) return;

  decorationFrameId = requestAnimationFrame(() => {
    decorationFrameId = null;
    applyDecorations();
  });
}


// prevent monaco error that occurs when try to delete all selection includes folding
monacoEditor.onKeyDown((e) => {
  if (monacoEditor.getOption(monaco.editor.EditorOption.readOnly)) return;
  const code = e.browserEvent.code;
  if (code !== "Delete" && code !== "Backspace") return;

  const model = monacoEditor.getModel();
  const sel = monacoEditor.getSelection();
  if (!model || !sel) return;
  const full = model.getFullModelRange();

  const isFull =
    sel.startLineNumber === full.startLineNumber &&
    sel.startColumn === full.startColumn &&
    sel.endLineNumber === full.endLineNumber &&
    sel.endColumn === full.endColumn;

  if (!isFull) return;

  const version = model.getVersionId();
  const selected = JSON.stringify(monacoEditor.getSelections());
  const valid = () => !model.isDisposed() && monacoEditor.getModel() === model && model.getVersionId() === version &&
    !monacoEditor.getOption(monaco.editor.EditorOption.readOnly) && JSON.stringify(monacoEditor.getSelections()) === selected;
  // check if folding exists
  const foldingController = monacoEditor.getContribution("editor.contrib.folding");
  foldingController?.foldingModelPromise.then((fm) => {
    if (!fm || !valid()) return;
    const hasCollapsed = Array.from({ length: fm.regions.length }).some((_, i) => fm.regions.isCollapsed(i));
    if (hasCollapsed) {
      e.preventDefault();
      e.stopPropagation();

      const act = monacoEditor.getAction("editor.unfoldAll");
      if (act) {
        act.run().then(() => {
          const selection = monacoEditor.getSelection();
          if (valid() && selection && !selection.isEmpty()) {
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


  monacoEditor.onDidChangeModel(() => { resetDecorationCoverage(); scheduleApplyDecorations(); });
  monacoEditor.onDidChangeModelContent(event => {
    const first = event.changes.reduce((line, change) => Math.min(line, change.range.startLineNumber), Infinity);
    invalidateCodeBlockCheckpoints(monacoEditor.getModel(), first);
    scheduleApplyDecorations();
  });
  monacoEditor.onDidScrollChange(scheduleApplyDecorations);
  monacoEditor.onDidLayoutChange(scheduleApplyDecorations);
  monacoEditor.onDidDispose(() => { if (decorationFrameId !== null) cancelAnimationFrame(decorationFrameId); });
  return { setKuromojiEnabled, applyDecorations, scheduleApplyDecorations };
}
