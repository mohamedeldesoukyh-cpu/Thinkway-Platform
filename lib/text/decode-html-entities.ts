/** Invisible Unicode formatting marks often scraped from social og:title metadata. */
const INVISIBLE_FORMATTING_MARKS = /[\u200B-\u200F\uFEFF]/g;

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/**
 * Decode HTML entities to plain text (named, decimal, and hex).
 * Safe for UI text nodes — does not interpret HTML tags.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value) return value;

  const decoded = value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return decoded.replace(INVISIBLE_FORMATTING_MARKS, "").trim();
}

/**
 * Strip platform page-title tails from scraped og:title metadata
 * (e.g. "Name (@h) • Instagram photos and videos" → "Name (@h)").
 */
const PLATFORM_PAGE_TITLE_SUFFIX_PATTERNS: RegExp[] = [
  /\s*[•·]\s*Instagram\s+photos\s+and\s+videos\s*$/i,
  /\s*-\s*YouTube\s*$/i,
  /\s*[|/]\s*TikTok\s*$/i,
  /\s*\/\s*X\s*$/i,
  /\s*[•·|]\s*Instagram\s*$/i,
  /\s*[•·|]\s*YouTube\s*$/i,
  /\s*[•·|]\s*TikTok\s*$/i,
  /\s*[•·|/]\s*Twitter\s*$/i,
  /\s*[•·|]\s*Facebook\s*$/i,
  /\s*[•·|]\s*Snapchat\s*$/i,
  /\s*[•·|]\s*LinkedIn\s*$/i,
  /\s+on\s+Instagram\s*$/i,
  /\s+on\s+TikTok\s*$/i,
  /\s+on\s+YouTube\s*$/i,
  /\s+on\s+X\s*$/i,
  /\s+on\s+Twitter\s*$/i,
];

function stripPlatformPageTitleSuffix(name: string): string {
  let result = name;
  for (const pattern of PLATFORM_PAGE_TITLE_SUFFIX_PATTERNS) {
    const next = result.replace(pattern, "");
    if (next !== result) {
      result = next.trimEnd();
    }
  }
  return result.trim();
}

/**
 * Bare platform / page-shell titles sometimes scraped as og:title / actor title
 * (e.g. login wall → "Instagram"). Not a real creator name.
 */
const BARE_PLATFORM_DISPLAY_NAMES = new Set([
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
  "twitter",
  "x",
  "x (twitter)",
  "facebook",
  "linkedin",
  "instagram photos and videos",
  "tiktok - make your day",
]);

export function isBarePlatformDisplayName(name: string | null | undefined): boolean {
  if (name == null) return false;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized.length > 0 && BARE_PLATFORM_DISPLAY_NAMES.has(normalized);
}

/** Internal creator document numbers must never appear as a display name (e.g. INF-008286). */
export function isCreatorDocumentNumber(name: string | null | undefined): boolean {
  if (name == null) return false;
  return /^(INF|DIS|CRT|VEN|TW)-\d+$/i.test(name.trim());
}

/** Normalize creator display names for UI (decode entities, strip bidi marks). */
export function formatCreatorDisplayName(name: string | null | undefined): string {
  if (name == null) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  // Handles belong on the secondary line — never keep a leading @ in the name field.
  const withoutAt = trimmed.replace(/^@+/, "").trim();
  if (!withoutAt) return "";
  const cleaned = stripPlatformPageTitleSuffix(decodeHtmlEntities(withoutAt));
  if (!cleaned || isBarePlatformDisplayName(cleaned) || isCreatorDocumentNumber(cleaned)) {
    return "";
  }
  return cleaned;
}

function normalizeCreatorNameKey(value: string | null | undefined): string {
  return (value ?? "").replace(/^@+/, "").trim().toLowerCase();
}

/** True when a label is just a handle/username (not a human display name). */
export function isUsernameLikeCreatorName(
  name: string | null | undefined,
  handle?: string | null
): boolean {
  const formatted = formatCreatorDisplayName(name);
  if (!formatted) return true;
  if (isCreatorDocumentNumber(formatted)) return true;
  const nameKey = normalizeCreatorNameKey(formatted);
  const handleKey = normalizeCreatorNameKey(handle);
  if (handleKey && nameKey === handleKey) return true;
  // Single token of handle characters → username-like (e.g. salehelnawawy).
  return !/\s/.test(formatted) && /^[a-z0-9._]+$/i.test(formatted);
}

/**
 * Prefer a human display name over username-like / document-number fallbacks.
 * If no real name exists, returns the username (without @). Never returns INF-xxxx.
 */
export function pickCreatorDisplayName(
  candidates: Array<string | null | undefined>,
  handle?: string | null
): string {
  const formatted = candidates
    .map((candidate) => formatCreatorDisplayName(candidate))
    .filter((value): value is string => Boolean(value));
  const human = formatted.find((value) => !isUsernameLikeCreatorName(value, handle));
  if (human) return human;
  const handleLabel = formatCreatorDisplayName(handle);
  if (handleLabel) return handleLabel;
  // Last resort: first non-document candidate, else plain handle key.
  if (formatted[0]) return formatted[0];
  const handleKey = normalizeCreatorNameKey(handle);
  return handleKey || "Creator";
}

/** Normalize creator bios for UI (decode HTML entities from scraped metadata). */
export function formatCreatorBio(bio: string | null | undefined): string | null {
  if (bio == null) return null;
  const trimmed = bio.trim();
  if (!trimmed) return null;
  return decodeHtmlEntities(trimmed);
}
