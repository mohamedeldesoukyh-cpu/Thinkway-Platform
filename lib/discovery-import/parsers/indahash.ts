import { parseCompactCount } from "@/lib/social/parse-compact-count";
import { isSocialPlatform } from "@/lib/social/platforms";
import {
  buildNormalizedRowLookup,
  lookupCell,
  normalizeExcelHeader,
} from "@/lib/intelligence/parsers/header-normalize";

import type { ParsedCreatorRow } from "../types";
import { parseImportContactFromLookup } from "../parse-contact";

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

function splitAudienceInterestTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const PLATFORM_FOLLOWER_COLUMNS: Array<{ platform: string; aliases: string[] }> = [
  {
    platform: "instagram",
    aliases: ["instagram followers", "ig followers", "instagram follower count"],
  },
  {
    platform: "tiktok",
    aliases: ["tiktok followers", "tik tok followers", "tt followers"],
  },
  {
    platform: "youtube",
    aliases: [
      "youtube followers",
      "yt followers",
      "youtube subscriber count",
      "subscribers",
    ],
  },
  {
    platform: "facebook",
    aliases: ["facebook followers", "fb followers"],
  },
];

const PROFILE_PICTURE_ALIASES = [
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
  "headshot",
] as const;

const ROLE_ALIASES = [
  "role",
  "creator role",
  "creator_role",
  "type",
  "creator type",
  "creator_type",
  "details",
  "creator details",
  "creator_details",
] as const;

function parseImportProfilePictureUrlRaw(
  lookup: Map<string, unknown>
): string | null {
  return lookupCell(lookup, ...PROFILE_PICTURE_ALIASES);
}

function parseImportRoleRaw(lookup: Map<string, unknown>): string | null {
  return lookupCell(lookup, ...ROLE_ALIASES);
}

function parsePlatformsList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const platforms: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(/[,;/|&+]/)) {
    const platform = normalizeImportPlatform(part.trim());
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    platforms.push(platform);
  }
  return platforms;
}

function hasMultiPlatformFollowerColumns(lookup: Map<string, unknown>): boolean {
  return PLATFORM_FOLLOWER_COLUMNS.some(({ aliases }) =>
    aliases.some((alias) => lookupCell(lookup, alias) != null)
  );
}

function hasPlatformFollowerColumnHeaders(lookup: Map<string, unknown>): boolean {
  return PLATFORM_FOLLOWER_COLUMNS.some(({ aliases }) =>
    aliases.some((alias) => lookup.has(normalizeExcelHeader(alias)))
  );
}

function shouldParseAsMultiPlatformRow(
  lookup: Map<string, unknown>,
  listedPlatforms: string[]
): boolean {
  if (hasMultiPlatformFollowerColumns(lookup)) return true;
  if (listedPlatforms.length > 1) return true;
  if (listedPlatforms.length === 1 && hasPlatformFollowerColumnHeaders(lookup)) {
    return true;
  }
  return false;
}

function parseTotalFollowers(lookup: Map<string, unknown>): number | null {
  return parseCompactCount(
    lookupCell(
      lookup,
      "total followers",
      "total_followers",
      "total follower count",
      "total follower"
    )
  );
}

function parseAppearances(lookup: Map<string, unknown>): number | null {
  const raw = lookupCell(lookup, "appearances", "appearance", "appearance count");
  if (raw == null) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/** When exactly one platform is present, fall back to Total Followers if per-platform count is empty. */
function resolveFollowersWithTotalFallback(
  lookup: Map<string, unknown>,
  platformSpecificFollowers: number | null,
  platformCount: number
): number | null {
  if (platformSpecificFollowers != null) return platformSpecificFollowers;
  if (platformCount !== 1) return null;
  return parseTotalFollowers(lookup);
}

function parseIndahashSharedFields(
  lookup: Map<string, unknown>,
  source: string | null
): Omit<ParsedCreatorRow, "platform" | "followers"> | null {
  const usernameRaw =
    lookupCell(
      lookup,
      "username",
      "handle",
      "creator",
      "social handle",
      "social username"
    ) ?? "";
  const username = usernameRaw.replace(/^@+/, "").trim();
  if (!username) return null;

  const engagement_rate = parsePercent(
    lookupCell(
      lookup,
      "engagement rate",
      "avg. engagement rate",
      "avg engagement rate",
      "avg er%",
      "avg er",
      "er%",
      "effective er",
      "engagement_rate"
    )
  );
  const country = lookupCell(
    lookup,
    "country",
    "audience country",
    "location",
    "geo",
    "market"
  );
  const categories = splitTags(
    lookupCell(lookup, "categories", "category", "niche", "content category")
  );
  const audience_interests = splitAudienceInterestTags(
    lookupCell(
      lookup,
      "audience interests",
      "interests",
      "audience_interests",
      "tags"
    )
  );
  const relevance_score = parsePercent(
    lookupCell(lookup, "relevance score", "relevance", "match score", "score")
  );
  const display_name = lookupCell(
    lookup,
    "display name",
    "display_name",
    "name",
    "creator name",
    "full name"
  );
  const contact = parseImportContactFromLookup(lookup);

  return {
    username,
    display_name,
    engagement_rate,
    country,
    source,
    categories,
    audience_interests,
    relevance_score,
    profile_picture_url: parseImportProfilePictureUrlRaw(lookup),
    role: parseImportRoleRaw(lookup),
    appearances: parseAppearances(lookup),
    ...contact,
  };
}

function parseIndahashMultiPlatformRows(
  row: Record<string, string>,
  source: string | null = "indaHash"
): ParsedCreatorRow[] {
  const lookup = buildNormalizedRowLookup(row);
  const listedPlatforms = parsePlatformsList(
    lookupCell(lookup, "platforms", "platform", "social network", "network", "channel")
  );
  if (!shouldParseAsMultiPlatformRow(lookup, listedPlatforms)) return [];

  const shared = parseIndahashSharedFields(lookup, source);
  if (!shared) return [];

  const platformsWithFollowers = PLATFORM_FOLLOWER_COLUMNS.flatMap(
    ({ platform, aliases }) => {
      const value = lookupCell(lookup, ...aliases);
      if (value == null) return [];
      return [platform];
    }
  );

  const platformOrder: string[] = [];
  const seenPlatforms = new Set<string>();
  for (const platform of [...listedPlatforms, ...platformsWithFollowers]) {
    if (seenPlatforms.has(platform)) continue;
    seenPlatforms.add(platform);
    platformOrder.push(platform);
  }

  if (platformOrder.length === 0) return [];

  const rows: ParsedCreatorRow[] = [];
  for (const platform of platformOrder) {
    const followerAliases =
      PLATFORM_FOLLOWER_COLUMNS.find((entry) => entry.platform === platform)
        ?.aliases ?? [];
    const platformFollowers = parseCompactCount(lookupCell(lookup, ...followerAliases));
    const followers = resolveFollowersWithTotalFallback(
      lookup,
      platformFollowers,
      platformOrder.length
    );
    const explicitlyListed = listedPlatforms.includes(platform);
    if (followers == null && !explicitlyListed) continue;

    rows.push({
      ...shared,
      platform,
      followers,
    });
  }

  return rows;
}

/** Parse one indaHash / generic tabular row into one or more creator rows. */
export function parseIndahashTabularRows(
  row: Record<string, string>,
  source: string | null = "indaHash"
): ParsedCreatorRow[] {
  const multiPlatformRows = parseIndahashMultiPlatformRows(row, source);
  if (multiPlatformRows.length > 0) return multiPlatformRows;

  const single = parseIndahashCsvRow(row, source);
  return single ? [single] : [];
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
    display_name: null,
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
    appearances: null,
    contact_email: null,
    contact_phone: null,
    contact_links: [],
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
    display_name: null,
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
    appearances: null,
    contact_email: null,
    contact_phone: null,
    contact_links: [],
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
  const lookup = buildNormalizedRowLookup(row);
  const shared = parseIndahashSharedFields(lookup, source);
  if (!shared) return null;

  const platformRaw = lookupCell(
    lookup,
    "platform",
    "platforms",
    "social network",
    "network",
    "channel"
  );
  const platform =
    normalizeImportPlatform(platformRaw) ??
    parsePlatformsList(platformRaw)[0] ??
    null;
  if (!platform) return null;

  const platformFollowers = parseCompactCount(
    lookupCell(
      lookup,
      "followers",
      "follower number",
      "follower count",
      "fans",
      "subscribers"
    )
  );
  const followers = resolveFollowersWithTotalFallback(lookup, platformFollowers, 1);

  return {
    ...shared,
    platform,
    followers,
  };
}
