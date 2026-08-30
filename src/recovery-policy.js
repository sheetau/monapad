const RECOVERY_MAX_ITEM_BYTES = 64 * 1024 * 1024;
const RECOVERY_MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

function getUtf8ByteLength(content) {
  return Buffer.byteLength(typeof content === "string" ? content : "", "utf8");
}

function createRecoveryLimitError(kind, actualBytes, maximumBytes) {
  const error = new Error(
    kind === "item"
      ? `Unsaved content is too large to protect (${actualBytes} bytes; maximum ${maximumBytes} bytes).`
      : `Recovery storage is full (${actualBytes} bytes; maximum ${maximumBytes} bytes).`,
  );
  error.code = kind === "item" ? "RECOVERY_ITEM_TOO_LARGE" : "RECOVERY_STORAGE_FULL";
  error.actualBytes = actualBytes;
  error.maximumBytes = maximumBytes;
  return error;
}

function assertRecoveryItemSize(content, maximumBytes = RECOVERY_MAX_ITEM_BYTES) {
  const contentBytes = getUtf8ByteLength(content);
  if (contentBytes > maximumBytes) throw createRecoveryLimitError("item", contentBytes, maximumBytes);
  return contentBytes;
}

function assertRecoveryTotalSize(totalBytes, maximumBytes = RECOVERY_MAX_TOTAL_BYTES) {
  if (totalBytes > maximumBytes) throw createRecoveryLimitError("total", totalBytes, maximumBytes);
  return totalBytes;
}

function planRecoveryCapacity(entries, requiredBytes, maximumBytes = RECOVERY_MAX_TOTAL_BYTES) {
  let retainedBytes = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.size) || 0), 0);
  const entriesToDelete = [];
  const discardable = entries
    .filter((entry) => Number.isInteger(entry?.cleanupPriority))
    .sort((a, b) => a.cleanupPriority - b.cleanupPriority || a.mtimeMs - b.mtimeMs);

  for (const entry of discardable) {
    if (retainedBytes + requiredBytes <= maximumBytes) break;
    entriesToDelete.push(entry);
    retainedBytes -= Math.max(0, Number(entry.size) || 0);
  }

  return {
    entriesToDelete,
    retainedBytes,
    projectedBytes: retainedBytes + requiredBytes,
  };
}

module.exports = {
  RECOVERY_MAX_ITEM_BYTES,
  RECOVERY_MAX_TOTAL_BYTES,
  assertRecoveryItemSize,
  assertRecoveryTotalSize,
  createRecoveryLimitError,
  getUtf8ByteLength,
  planRecoveryCapacity,
};
