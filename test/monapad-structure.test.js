const assert = require("node:assert/strict");
const test = require("node:test");
const { OPEN_FENCE, CLOSE_FENCE, scanStructure, computeFoldingRanges } = require("../src/monapad-structure");
const fold = (text, size) => computeFoldingRanges(text.split("\n"), size);

test("Unicode fence labels and only standalone closing fences share the same grammar", () => {
  assert.ok(OPEN_FENCE.test("  ```日本語の説明"));
  assert.ok(OPEN_FENCE.test("```💡"));
  assert.ok(CLOSE_FENCE.test("\t``` "));
  assert.ok(!CLOSE_FENCE.test("text ```"));
  assert.ok(!CLOSE_FENCE.test("```別の説明"));
  const source = ["```日本語", "# not a heading", "```still inside", "## also inside", "```", "# outside"];
  const result = scanStructure(source);
  assert.deepEqual(result.blocks, [{ start: 1, end: 5 }]);
  assert.deepEqual(result.headings.map(h => h.start), [6]);
  assert.deepEqual(scanStructure(source.slice(0, 4)).headings, []);
});

test("indentation nests within headings and cannot cross the next heading", () => {
  assert.deepEqual(fold("# Section\nparent\n    child\n        leaf\n    peer\n\n## Child section\n    text\n# Next\nend"), [
    { start: 1, end: 8 }, { start: 2, end: 5 }, { start: 3, end: 4 },
    { start: 7, end: 8 }, { start: 9, end: 10 },
  ]);
});

test("indented headings combine their heading and indentation levels", () => {
  assert.deepEqual(fold("# A\n    # B\nbody\n## C\nbody\n# D\nbody"), [
    { start: 1, end: 5 }, { start: 2, end: 3 }, { start: 4, end: 5 }, { start: 6, end: 7 },
  ]);
});

test("tabs advance to configured stops, partial indents do not create a full level", () => {
  const text = "root\n  child\n\tleaf\nend";
  assert.deepEqual(fold(text, 4), [{ start: 2, end: 3 }]);
  assert.deepEqual(fold(text, 2), [{ start: 1, end: 3 }]);
  assert.deepEqual(fold("root\n \tchild\n\nend", 4), [{ start: 1, end: 2 }]);
});

test("fenced blocks are atomic children and unterminated fences extend to EOF", () => {
  assert.deepEqual(fold("# A\nparent\n    ```python\n# literal\n  any indent\n    ```\npeer\n# B"), [
    { start: 1, end: 7 }, { start: 2, end: 6 }, { start: 3, end: 6 },
  ]);
  assert.deepEqual(fold("# A\n```日本語\n# literal\n\n"), [{ start: 1, end: 5 }, { start: 2, end: 5 }]);
});

test("large alternating structures have no crossing ranges or duplicate starts", () => {
  let seed = 7;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
  for (let sample = 0; sample < 100; sample++) {
    const lines = Array.from({ length: 150 }, () => " ".repeat((random() >>> 16) % 16) + ["body", "# A", "## B", "```日本語", "```", ""][(random() >>> 16) % 6]);
    const ranges = computeFoldingRanges(lines);
    const stack = [];
    const starts = new Set();
    for (const range of ranges) {
      assert.ok(!starts.has(range.start));
      starts.add(range.start);
      while (stack.length && range.start > stack.at(-1).end) stack.pop();
      if (stack.length) assert.ok(range.end <= stack.at(-1).end, JSON.stringify({ lines, stack, range }));
      stack.push(range);
    }
  }
});
