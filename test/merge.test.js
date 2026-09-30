const assert = require("node:assert/strict");
const test = require("node:test");
const { renderMerge } = require("../src/merge-model");
const computation = import("../src/merge-computation.mjs");
async function merge(base, local, disk, choices, eol) {
  const { computeMerge } = await computation;
  const plan = computeMerge(base, local, disk);
  return { plan, ...renderMerge(plan, choices, eol) };
}
test("merges disjoint replacements, additions and deletions", async () => {
  assert.equal((await merge("a\nb\nc\nd", "A\nb\nc\nd", "a\nb\nc\nD")).content, "A\nb\nc\nD");
  const result = await merge("a\nb\nc\nd\ne", "a\nnew\nb\nc\nd\ne", "a\nb\nc\ne");
  assert.equal(result.content, "a\nnew\nb\nc\ne");
  assert.equal(result.unresolved, 0);
});
test("identical edits are included only once", async () => {
  for (const text of ["", "same", "a\ninsert\nb", "a\nb\n"]) {
    const result = await merge("a\nb", text, text);
    assert.equal(result.content, text); assert.equal(result.unresolved, 0);
  }
});
test("overlapping replacements require an explicit choice", async () => {
  const result = await merge("a\nb\nc", "a\nlocal\nc", "a\ndisk\nc");
  assert.equal(result.unresolved, 1);
  assert.equal(renderMerge(result.plan, {0:"local"}).content, "a\nlocal\nc");
  assert.equal(renderMerge(result.plan, {0:"disk"}).content, "a\ndisk\nc");
  assert.equal(renderMerge(result.plan, {0:"both"}).content, "a\nlocal\ndisk\nc");
});
test("same-position insertion and delete/edit overlap are conflicts", async () => {
  const insert = await merge("a\nb", "a\nx\nb", "a\ny\nb");
  assert.equal(insert.unresolved, 1);
  assert.equal(renderMerge(insert.plan, {0:"both"}).content, "a\nx\ny\nb");
  const deletion = await merge("a\nb\nc", "a\nc", "a\nB\nc");
  assert.equal(deletion.unresolved, 1);
  assert.equal(renderMerge(deletion.plan, {0:"local"}).content, "a\nc");
});
test("preserves trailing newline changes and selected EOL independently", async () => {
  assert.equal((await merge("a\nb", "A\nb", "a\nb\n")).content, "A\nb\n");
  assert.equal((await merge("a\r\nb\r\nc\r\n", "A\r\nb\r\nc\r\n", "a\nb\nC\n", {}, "\r\n")).content, "A\r\nb\r\nC\r\n");
  assert.equal((await merge("", "text", "")).content, "text");
});
test("randomized one-sided edits round-trip without loss", async () => {
  let seed = 415;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let n = 0; n < 400; n++) {
    const base = Array.from({length: random(25)+1}, () => String(random(8))).join("\n");
    const target = Array.from({length: random(25)+1}, () => String(random(8))).join("\n");
    const left = await merge(base,target,base), right = await merge(base,base,target);
    assert.equal(left.content,target); assert.equal(right.content,target);
    assert.equal(left.unresolved,0); assert.equal(right.unresolved,0);
  }
});
test("large unchanged documents avoid argument limits; excessive comparisons refuse safely", async () => {
  const value = "a\n".repeat(99998) + "end";
  assert.equal((await merge(value, value, value)).content, value);
  const {computeMerge} = await computation;
  assert.throws(() => computeMerge("", "x".repeat(5000001), ""), /tooLarge/);
  assert.throws(() => computeMerge("a\n".repeat(100000), "", ""), /tooLarge/);
  assert.throws(() => computeMerge("a\n".repeat(15000), "b\n".repeat(15000), ""), /tooLarge/);
});
