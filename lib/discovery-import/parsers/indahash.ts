import { parseCompactCount } from "@/lib/social/parse-compact-count";
import { isSocialPlatform } from "@/lib/social/platforms";

import type { ParsedCreatorRow } from "../types";

const PLATFORM_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  tiktok: "tiktok",
  "tik tok": "tiktok",
  tt: "tiktok",
  youtube: "youtube",
  yt: "youtube",
  twitter: "twitter",
  x: "twitter",
  snapchat: "snapchat",
  sc: "snapchat",
  facebook: "facebook",
  fb: "facebook",
  linkedin: "linkedin",
};

const INDASH_MARKERS = [
  "indahash",
  "relevance score",
  "avg er",
  "avg er%",
  "effective er",
  "audience interests",
  "creator demographics",
];

export function isIndahashText(text: string): boolean {
  const lower = text.toLowerCase();
  return INDASH_MARKERS.some((marker) => lower.includes(marker));
}

export function normalizeImportPlatform(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = value.trim().toLowerCase();
  return PLATFORM_ALIASES[key] ?? (isSocialPlatform(key) ? key : null);
}

function parsePercent(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.trim().replace(/%/g, "");
  const num = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function splitTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseIndahashBlock(block: string, source: string | null): ParsedCreatorRow | null {
  const trimmed = block.trim();
  if (!trimmed.startsWith("@")) return null;

  const usernameMatch = trimmed.match(/^@([a-zA-Z0-9._]+)/);
  if (!usernameMatch) return null;

  const username = usernameMatch[1];
  const rest = trimmed.slice(usernameMatch[0].length).trim();
  if (!rest) return null;

  const platformMatch = rest.match(
    /^(Instagram|TikTok|Tik Tok|YouTube|Twitter|X|Snapchat|Facebook|LinkedIn)\b/i
  );
  if (!platformMatch) return null;

  const platform = normalizeImportPlatform(platformMatch[1]);
  if (!platform) return null;

  const afterPlatform = rest.slice(platformMatch[0].length).trim();
  const tokenMatch = afterPlatform.match(
    /^([\d,.]+[KMBkmb]?)\s+([\d,.]+)\s*%?\s+(.+?)\s+([\d,.]+)\s*$/
  );

  if (!tokenMatch) return null;

  const followers = parseCompactCount(tokenMatch[1]);
  const engagement_rate = parsePercent(tokenMatch[2]);
  const middle = tokenMatch[3].trim();
  const relevance_score = parsePercent(tokenMatch[4]);

  const interestSplit = middle.match(/^(.+?)\s+((?:[A-Za-z][^,]+(?:,\s*[^,]+)+))$/);
  let country = middle;
  let tags = "";

  if (interestSplit) {
    country = interestSplit[1].trim();
    tags = interestSplit[2].trim();
  } else {
    const lastComma = middle.lastIndexOf(",");
    if (lastComma > 0) {
      country = middle.slice(0, lastComma).trim();
      tags = middle.slice(lastComma + 1).trim();
    }
  }

  const categories = splitTags(tags);
  const audience_interests = categories.length > 0 ? [...categories] : [];

  return {
    username,
    platform,
    followers,
    engagement_rate,
    country: country || null,
    source,
    categories,
    audience_interests,
    relevance_score,
    profile_picture_url: null,
    role: null,
  };
}

/** Parse indaHash-style creator rows from PDF text or plain-text exports. */
export function parseIndahashText(
  text: string,
  source: string | null = "indaHash"
): ParsedCreatorRow[] {
  const rows: ParsedCreatorRow[] = [];
  const seen = new Set<string>();

  const blocks = text.split(/(?=@)/g);
  for (const block of blocks) {
    const row = parseIndahashBlock(block, source);
    if (!row) continue;
    const key = `${row.platform}:${row.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

// -----------------------------------------------------------------------------
// indaHash web "Creator Search" PDF export
// -----------------------------------------------------------------------------
// The structured `@handle Platform followers ER% country tags relevance` layout
// (parseIndahashText above) only appears in synthetic/CSV-style exports. The real
// indaHash web app "Creator Search" PDF flattens a multi-column table into an
// unordered token stream where each creator looks roughly like:
//
//   <audience interest phrases...>
//   <handle> <audience interest phrases...>
//   <ER%> 100 <rank>            (order of ER% / 100 / rank varies per row)
//   <followers> <reach> ... <audience interest phrases...>
//
// Handles have NO leading "@", carry no per-row platform/country, and the numeric
// fields are interleaved with Title-Case interest phrases. We recover creators by
// anchoring on lowercase handle tokens and pulling the metric tokens that follow
// each handle (up to the next handle).

const SEARCH_EXPORT_STOPWORDS = new Set([
  "to", "search", "history", "posts", "post", "avg", "recent", "results",
  "result", "select", "all", "audience", "interests", "interest", "relevance",
  "type", "clear", "filters", "filter", "sort", "upload", "file", "use", "find",
  "creators", "creator", "campaign", "brief", "gender", "follower", "followers",
  "country", "category", "categories", "er", "ai", "and", "the", "score",
  "based", "on", "fit", "export", "list", "page", "of", "show", "more", "less",
  "view", "profile", "name", "email", "add", "selected", "export",
]);

const SEARCH_PERCENT_RE = /^(\d+(?:\.\d+)?)%$/;
const SEARCH_COMPACT_WITH_SUFFIX_RE = /^\d[\d.,]*[kmb]$/i;
const SEARCH_COMPACT_ANY_RE = /^\d[\d.,]*[kmb]?$/i;
const SEARCH_USERNAME_RE = /^[a-z0-9_][a-z0-9._]{2,}$/;

function isSearchExportUsername(token: string): boolean {
  const cleaned = token.replace(/[.,]+$/, "");
  if (!SEARCH_USERNAME_RE.test(cleaned)) return false;
  if (SEARCH_EXPORT_STOPWORDS.has(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (SEARCH_COMPACT_ANY_RE.test(cleaned)) return false;
  if (SEARCH_PERCENT_RE.test(cleaned)) return false;
  return true;
}

function detectFilterCountry(text: string): string | null {
  const match = text.match(
    /Country\s*:\s*([A-Za-z][A-Za-z ]*?)(?=\s+(?:Follower|Gender|Category|Categories|>|Sort)|$)/
  );
  return match ? match[1].trim() || null : null;
}

// Audience-interest chips are Title-Case phrases (e.g. "Camera & Photography",
// "Clothes, Shoes, Handbags & Accessories") interleaved with the numeric metric
// tokens that follow each handle. Each phrase is a run of capitalized words
// joined by spaces, commas, and a trailing "& <word>"; numbers/percentages and
// lowercase UI words (e.g. "Type to search") break the run.
const SEARCH_PHRASE_WORD_RE = /^[A-Za-z][A-Za-zÀ-ÿ'’.-]*,?$/;

function isPhraseWordToken(token: string): boolean {
  if (/\d/.test(token)) return false;
  if (SEARCH_PERCENT_RE.test(token)) return false;
  if (SEARCH_COMPACT_ANY_RE.test(token)) return false;
  return SEARCH_PHRASE_WORD_RE.test(token);
}

function isUpperPhraseWord(token: string): boolean {
  return /^[A-ZÀ-Þ]/.test(token) && isPhraseWordToken(token);
}

/** Reconstruct audience-interest phrases from a creator's token window. */
function extractInterestPhrases(windowTokens: string[]): string[] {
  const phrases: string[] = [];
  let buffer: string[] = [];
  let pendingAmp = false;

  const flush = () => {
    while (buffer.length > 0 && buffer[buffer.length - 1] === "&") buffer.pop();
    if (buffer.length === 0) {
      pendingAmp = false;
      return;
    }
    const phrase = buffer.join(" ").trim();
    const words = phrase.replace(/[,&]/g, " ").split(/\s+/).filter(Boolean);
    const allStopwords = words.every((word) =>
      SEARCH_EXPORT_STOPWORDS.has(word.toLowerCase())
    );
    if (words.length > 0 && !allStopwords) phrases.push(phrase);
    buffer = [];
    pendingAmp = false;
  };

  for (const token of windowTokens) {
    if (token === "&") {
      if (buffer.length > 0) {
        buffer.push("&");
        pendingAmp = true;
      }
      continue;
    }

    if (isUpperPhraseWord(token)) {
      if (buffer.length === 0) {
        buffer.push(token);
        continue;
      }
      if (pendingAmp) {
        // A phrase always terminates after the word following its "&".
        buffer.push(token);
        flush();
        continue;
      }
      // Continue the phrase when the previous word kept it open with a comma;
      // otherwise treat adjacent capitalized words as separate chips.
      if (buffer[buffer.length - 1].endsWith(",")) {
        buffer.push(token);
        continue;
      }
      flush();
      buffer.push(token);
      continue;
    }

    // Numbers, percentages, compact counts and lowercase words end a phrase.
    flush();
  }
  flush();

  const seen = new Set<string>();
  const result: string[] = [];
  for (const phrase of phrases) {
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(phrase);
  }
  return result;
}

function buildSearchExportRow(
  username: string,
  windowTokens: string[],
  source: string | null,
  platform: string,
  country: string | null
): ParsedCreatorRow | null {
  let engagement_rate: number | null = null;
  let percentIndex = -1;
  for (let i = 0; i < windowTokens.length; i++) {
    const match = windowTokens[i].match(SEARCH_PERCENT_RE);
    if (match) {
      engagement_rate = Number(match[1]);
      percentIndex = i;
      break;
    }
  }

  let followers: number | null = null;
  for (const token of windowTokens) {
    if (SEARCH_COMPACT_WITH_SUFFIX_RE.test(token)) {
      followers = parseCompactCount(token);
      break;
    }
  }
  if (followers == null) {
    for (const token of windowTokens) {
      const digits = token.replace(/[.,]/g, "");
      if (/^\d{4,}$/.test(digits)) {
        followers = parseCompactCount(token);
        break;
      }
    }
  }

  // Relevance score sits immediately next to the ER% token (typically 100).
  let relevance_score: number | null = null;
  if (percentIndex >= 0) {
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue;
      const neighbor = windowTokens[percentIndex + offset];
      if (neighbor && /^\d{1,3}$/.test(neighbor)) {
        const value = Number(neighbor);
        if (value >= 0 && value <= 100) {
          if (relevance_score == null || value > relevance_score) {
            relevance_score = value;
          }
        }
      }
    }
  }

  if (engagement_rate == null || followers == null) return null;

  const categories = extractInterestPhrases(windowTokens);

  return {
    username,
    platform,
    followers,
    engagement_rate,
    country,
    source,
    categories,
    audience_interests: [...categories],
    relevance_score,
    profile_picture_url: null,
    role: null,
  };
}

/**
 * Parse the indaHash web "Creator Search" PDF export, where the table is
 * flattened into a token stream and handles have no leading "@".
 */
export function parseIndahashSearchExport(
  text: string,
  source: string | null = "indaHash",
  options: { defaultPlatform?: string } = {}
): ParsedCreatorRow[] {
  const platform = normalizeImportPlatform(options.defaultPlatform) ?? "instagram";
  const country = detectFilterCountry(text);
  const tokens = text.split(/\s+/).filter(Boolean);

  const windows: Array<{ username: string; tokens: string[] }> = [];
  let current: { username: string; tokens: string[] } | null = null;

  for (const token of tokens) {
    if (isSearchExportUsername(token)) {
      current = { username: token.replace(/[.,]+$/, ""), tokens: [] };
      windows.push(current);
      continue;
    }
    if (current) current.tokens.push(token);
  }

  const rows: ParsedCreatorRow[] = [];
  const seen = new Set<string>();
  for (const window of windows) {
    const row = buildSearchExportRow(
      window.username,
      window.tokens,
      source,
      platform,
      country
    );
    if (!row) continue;
    const key = `${row.platform}:${row.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

export function parseIndahashCsvRow(
  row: Record<string, string>,
  source: string | null = "indaHash"
): ParsedCreatorRow | null {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(key.trim().toLowerCase(), String(value ?? "").trim());
  }

  const lookup = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = normalized.get(alias.toLowerCase());
      if (value) return value;
    }
    return null;
  };

  const usernameRaw =
    lookup("username", "handle", "creator", "social handle", "social username") ??
    "";
  const username = usernameRaw.replace(/^@+/, "").trim();
  if (!username) return null;

  const platform = normalizeImportPlatform(
    lookup("platform", "social network", "network", "channel")
  );
  if (!platform) return null;

  const followers = parseCompactCount(
    lookup("followers", "follower number", "follower count", "fans", "subscribers")
  );
  const engagement_rate = parsePercent(
    lookup(
      "engagement rate",
      "avg er%",
      "avg er",
      "er%",
      "effective er",
      "engagement_rate"
    )
  );
  const country = lookup("country", "audience country", "location", "geo");
  const categories = splitTags(
    lookup("categories", "category", "niche", "content category")
  );
  const audience_interests = splitTags(
    lookup("audience interests", "interests", "audience_interests", "tags")
  );
  const relevance_score = parsePercent(
    lookup("relevance score", "relevance", "match score", "score")
  );
  const profile_picture_url = lookup(
    "avatar url",
    "avatar_url",
    "profile photo",
    "profile_photo",
    "profile picture url",
    "profile_picture_url",
    "profile picture",
    "profile_picture",
    "profile pic",
    "profile_pic",
    "profile image url",
    "profile_image_url",
    "profile image",
    "profile_image",
    "image url",
    "image_url",
    "photo",
    "picture",
    "avatar",
    "thumbnail",
    "headshot"
  );
  const role = lookup(
    "role",
    "creator role",
    "creator_role",
    "type",
    "creator type",
    "creator_type",
    "details",
    "creator details",
    "creator_details"
  );

  return {
    username,
    platform,
    followers,
    engagement_rate,
    country,
    source,
    categories: categories.length > 0 ? categories : audience_interests,
    audience_interests:
      audience_interests.length > 0 ? audience_interests : categories,
    relevance_score,
    profile_picture_url,
    role,
  };
}
