// One fence grammar for highlighting, symbols and folding. Info strings may be Unicode.
const OPEN_FENCE = /^[\t ]*```.*$/;
const CLOSE_FENCE = /^[\t ]*```[\t ]*$/;

function indentation(line, tabSize) {
  let column = 0;
  for (const char of line) {
    if (char === " ") column++;
    else if (char === "\t") column += tabSize - (column % tabSize);
    else break;
  }
  return Math.floor(column / tabSize);
}

function scanStructure(lines, tabSize = 4) {
  tabSize = Math.max(1, Math.floor(tabSize) || 4);
  const blocks = [];
  const headings = [];
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const start = i + 1;
    const indent = indentation(line, tabSize);
    if (OPEN_FENCE.test(line)) {
      let end = i + 1;
      while (end < lines.length && !CLOSE_FENCE.test(lines[end])) end++;
      end = Math.min(end + 1, lines.length);
      blocks.push({ start, end });
      entries.push({ start, end, indent, block: true });
      i = end - 1;
      continue;
    }
    const match = line.match(/^[\t ]*(#{1,3})[\t ]+(.*)$/);
    const entry = { start, end: start, indent };
    if (match) {
      entry.heading = true;
      entry.level = indent + match[1].length;
      headings.push({ ...entry, title: match[2], prefix: match[1] });
    }
    entries.push(entry);
  }
  return { blocks, headings, entries };
}

function computeFoldingRanges(lines, tabSize = 4) {
  const { blocks, headings, entries } = scanStructure(lines, tabSize);
  const ranges = blocks.filter(({ start, end }) => end > start);
  const stack = [];
  function addHeading(heading, end) {
    // Blank lines inside an unterminated fence belong to that fence and its parent.
    const protectedEnd = blocks.at(-1)?.end === end ? end : heading.start;
    while (end > protectedEnd && !lines[end - 1].trim()) end--;
    if (end > heading.start) ranges.push({ start: heading.start, end });
  }
  for (const heading of headings) {
    while (stack.length && stack.at(-1).level >= heading.level) addHeading(stack.pop(), heading.start - 1);
    stack.push(heading);
  }
  while (stack.length) addHeading(stack.pop(), lines.length);

  // Indentation is local to the body between headings. Fenced blocks are atomic.
  // A heading owns its entire section, so it never gets a second indentation range.
  const indents = [];
  let previous = null;
  for (const entry of entries) {
    if (entry.heading) {
      while (indents.length) {
        const parent = indents.pop();
        if (previous.end > parent.start) ranges.push({ start: parent.start, end: previous.end });
      }
      previous = null;
      continue;
    }
    while (indents.length && entry.indent <= indents.at(-1).indent) {
      const parent = indents.pop();
      ranges.push({ start: parent.start, end: previous.end });
    }
    if (previous && !previous.block && entry.indent > previous.indent) indents.push(previous);
    previous = entry;
  }
  while (indents.length) ranges.push({ start: indents.pop().start, end: previous.end });
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

module.exports = { OPEN_FENCE, CLOSE_FENCE, scanStructure, computeFoldingRanges };
