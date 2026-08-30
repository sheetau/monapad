const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RECOVERY_MAX_ITEM_BYTES,
  RECOVERY_MAX_TOTAL_BYTES,
  assertRecoveryItemSize,
  assertRecoveryTotalSize,
  getUtf8ByteLength,
  planRecoveryCapacity,
} = require("../src/recovery-policy");

test("uses bounded recovery limits larger than the previous autosave limits", () => {
  assert.equal(RECOVERY_MAX_ITEM_BYTES, 64 * 1024 * 1024);
  assert.equal(RECOVERY_MAX_TOTAL_BYTES, 1024 * 1024 * 1024);
  assert.ok(RECOVERY_MAX_TOTAL_BYTES >= RECOVERY_MAX_ITEM_BYTES);
});

test("measures recovery content as UTF-8 bytes", () => {
  assert.equal(getUtf8ByteLength("abc"), 3);
  assert.equal(getUtf8ByteLength("あ"), 3);
});

test("accepts exact recovery boundaries and rejects the first byte above them", () => {
  assert.equal(assertRecoveryItemSize("12345", 5), 5);
  assert.throws(() => assertRecoveryItemSize("123456", 5), { code: "RECOVERY_ITEM_TOO_LARGE" });
  assert.equal(assertRecoveryTotalSize(10, 10), 10);
  assert.throws(() => assertRecoveryTotalSize(11, 10), { code: "RECOVERY_STORAGE_FULL" });
});

test("capacity cleanup only selects disposable trash and never unsaved backups", () => {
  const draft = { id: "draft", size: 90, mtimeMs: 1 };
  const previousTrash = { id: "previous", size: 15, mtimeMs: 3, cleanupPriority: 0 };
  const currentTrash = { id: "current", size: 10, mtimeMs: 2, cleanupPriority: 1 };
  const plan = planRecoveryCapacity([draft, currentTrash, previousTrash], 10, 100);

  assert.deepEqual(
    plan.entriesToDelete.map((entry) => entry.id),
    ["previous", "current"],
  );
  assert.equal(plan.projectedBytes, 100);
  assert.ok(!plan.entriesToDelete.includes(draft));

  const full = planRecoveryCapacity([draft], 11, 100);
  assert.deepEqual(full.entriesToDelete, []);
  assert.equal(full.projectedBytes, 101);
});
