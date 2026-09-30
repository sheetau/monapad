const normalize = text => text.replace(/\r\n?/g, "\n");
const same = (a, b) => a.length === b.length && a.every((line, i) => line === b[i]);

function overlaps(a, b) {
  // Insertions at a replaced/deleted boundary are conservative conflicts.
  if (a.start === a.end) return b.start <= a.start && a.start <= b.end;
  if (b.start === b.end) return a.start <= b.start && b.start <= a.end;
  return a.start < b.end && b.start < a.end;
}

function buildMergePlan(base, localEdits, diskEdits) {
  const edits = [...localEdits.map(e => ({ ...e, side: "local" })), ...diskEdits.map(e => ({ ...e, side: "disk" }))]
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const parts = [];
  let cursor = 0;
  let conflicts = 0;
  for (let i = 0; i < edits.length;) {
    const group = [edits[i++]];
    let end = group[0].end;
    while (i < edits.length && edits[i].start <= end && group.some(e => overlaps(e, edits[i]))) {
      group.push(edits[i]);
      end = Math.max(end, edits[i++].end);
    }
    const start = group[0].start;
    parts.push({ lines: base.slice(cursor, start) });
    const render = side => {
      const output = [];
      let position = start;
      for (const edit of group.filter(e => e.side === side)) {
        for (const line of base.slice(position, edit.start)) output.push(line);
        for (const line of edit.lines) output.push(line);
        position = edit.end;
      }
      for (const line of base.slice(position, end)) output.push(line);
      return output;
    };
    const local = render("local"), disk = render("disk");
    if (!group.some(e => e.side === "local")) parts.push({ lines: disk });
    else if (!group.some(e => e.side === "disk") || same(local, disk)) parts.push({ lines: local });
    else parts.push({ id: conflicts++, start, end, base: base.slice(start, end), local, disk });
    cursor = end;
  }
  parts.push({ lines: base.slice(cursor) });
  return { parts, conflicts };
}

function renderMerge(plan, choices = {}, eol = "\n") {
  const lines = [];
  const locations = [];
  let unresolved = 0;
  for (const part of plan.parts) {
    if (part.lines) { for (const line of part.lines) lines.push(line); continue; }
    locations.push({ id: part.id, line: lines.length + 1 });
    const choice = choices[part.id];
    if (!choice) unresolved++;
    const selected = choice === "disk" ? part.disk : choice === "both" ? [...part.local, ...part.disk] : part.local;
    for (const line of selected) lines.push(line);
  }
  return { content: lines.join(eol), unresolved, locations };
}

module.exports = { normalize, buildMergePlan, renderMerge };
