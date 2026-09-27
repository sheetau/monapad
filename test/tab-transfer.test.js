const assert = require("node:assert/strict");
const test = require("node:test");
const { getTransferredExternalState, restoreTransferredExternalState } = require("../src/tab-transfer");

test("moving an unsaved file preserves the disk snapshot rather than the model content", () => {
  const source = {
    path: "note.txt", originalContent: "saved", content: "unsaved",
    _lastExternalContent: "saved", _lastExternalHasBom: true, _lastExternalIsUtf8Valid: false,
    _lastExternalFileSize: 8, _lastExternalModifiedTimeMs: 123, _lastExternalChangedTimeMs: 456,
  };
  const payload = JSON.parse(JSON.stringify({ ...source, ...getTransferredExternalState(source) }));
  const target = { path: source.path, _lastExternalContent: payload.content };
  restoreTransferredExternalState(target, payload);
  assert.deepEqual(getTransferredExternalState(target), getTransferredExternalState(source));
});

test("an acknowledged external change survives a transfer independently of the saved baseline", () => {
  const target = { path: "note.txt" };
  restoreTransferredExternalState(target, { originalContent: "saved", _lastExternalContent: "external change" });
  assert.equal(target._lastExternalContent, "external change");
  restoreTransferredExternalState(target, { originalContent: "legacy saved" });
  assert.equal(target._lastExternalContent, "legacy saved");
});
