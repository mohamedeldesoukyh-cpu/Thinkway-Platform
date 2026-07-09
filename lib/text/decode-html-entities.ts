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

/** Normalize creator display names for UI (decode entities, strip bidi marks). */
export function formatCreatorDisplayName(name: string | null | undefined): string {
  if (name == null) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return stripPlatformPageTitleSuffix(decodeHtmlEntities(trimmed));
}

/** Normalize creator bios for UI (decode HTML entities from scraped metadata). */
export function formatCreatorBio(bio: string | null | undefined): string | null {
  if (bio == null) return null;
  const trimmed = bio.trim();
  if (!trimmed) return null;
  return decodeHtmlEntities(trimmed);
}
