const EXTERNAL_FIELDS = [
  "_lastExternalContent", "_lastExternalHasBom", "_lastExternalIsUtf8Valid",
  "_lastExternalFileSize", "_lastExternalModifiedTimeMs", "_lastExternalChangedTimeMs",
];

function getTransferredExternalState(tab) {
  return Object.fromEntries(EXTERNAL_FIELDS.map((key) => [key, tab[key]]));
}

function restoreTransferredExternalState(tab, payload) {
  if (!tab.path) return;
  // Older payloads contain the saved baseline, never use the unsaved model as a disk snapshot.
  tab._lastExternalContent = payload.originalContent ?? "";
  for (const key of EXTERNAL_FIELDS) {
    if (Object.hasOwn(payload, key)) tab[key] = payload[key];
  }
}

module.exports = { getTransferredExternalState, restoreTransferredExternalState };
