export const DEFAULT_THEME_NAMES = ["dark", "onyx", "ash"];
export const NOTE_BADGE_EDGES = [
  { key: "top", bit: 1 },
  { key: "right", bit: 2 },
  { key: "bottom", bit: 4 },
  { key: "left", bit: 8 },
];
export const NOTE_BADGE_ALL_FILTER = "all";
export const NOTE_TITLE_MAX_LENGTH = 100;
export const GLOBAL_SEARCH_PREVIEW_MAX = 1000;

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getUiLanguageTag(lang = "en") {
  return (
    {
      en: "en-US",
      ja: "ja-JP",
      zh: "zh-CN",
      de: "de-DE",
      pt: "pt-BR",
    }[lang] || lang
  );
}

export function normalizeTextForModelComparison(text) {
  return (typeof text === "string" ? text : "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function isDefaultThemeName(theme) {
  return DEFAULT_THEME_NAMES.includes(theme);
}

export function normalizeNoteBadgeMask(mask) {
  const value = Number(mask);
  return Number.isInteger(value) ? value & 15 : 0;
}

export function getNoteBadgeClass(mask) {
  const value = normalizeNoteBadgeMask(mask);
  return [
    value & 1 ? "has-top" : "",
    value & 2 ? "has-right" : "",
    value & 4 ? "has-bottom" : "",
    value & 8 ? "has-left" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function truncateNoteTitle(title) {
  const value = String(title || "").trim();
  if (value.length <= NOTE_TITLE_MAX_LENGTH) return value;
  return `${value.slice(0, NOTE_TITLE_MAX_LENGTH)}...`;
}

export function formatNoteUpdatedAt(updatedAt) {
  if (!updatedAt) return "";
  try {
    return new Date(updatedAt).toLocaleString();
  } catch {
    return "";
  }
}

export function normalizeFileReadResult(result) {
  if (result === null || result === undefined) return null;
  if (typeof result === "string") {
    return {
      content: result,
      encoding: "UTF-8",
      isUtf8Valid: true,
      hasBom: false,
    };
  }
  if (typeof result === "object" && typeof result.content === "string") {
    return {
      content: result.content,
      encoding: result.encoding || (result.isUtf8Valid === false ? "Invalid UTF-8" : "UTF-8"),
      isUtf8Valid: result.isUtf8Valid !== false,
      hasBom: Boolean(result.hasBom),
    };
  }
  return null;
}

export function getPathBasename(filePath) {
  return (
    String(filePath || "")
      .split(/[/\\]/)
      .pop() || String(filePath || "")
  );
}

export function countNoteBadgeEdges(mask) {
  let value = normalizeNoteBadgeMask(mask);
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

export function normalizeSearchPreviewText(text) {
  return String(text || "").replace(/\s+/g, " ");
}

export function escapeSearchPreview(text, maxLength = GLOBAL_SEARCH_PREVIEW_MAX) {
  const value = normalizeSearchPreviewText(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function getSearchResultPathDisplay(fullPath) {
  const value = String(fullPath || "");
  if (!value) return "";
  const index = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  return index > 0 ? value.slice(0, index) : value;
}

export function isPointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
