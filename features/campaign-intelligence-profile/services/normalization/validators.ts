import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { DISCOVERY_PLATFORMS, type DiscoveryPlatform } from "@/lib/discovery/types";

import {
  BAD_CATEGORY_TOKENS,
  FIELD_LABEL_FRAGMENTS,
  NICHE_PATTERNS,
  QUICK_CATEGORIES,
} from "./constants";
import type { ExtractionIssue, NormalizedGender } from "./types";

const FOLLOWER_RANGE_PATTERN =
  /(\d[\d,.\s]*)\s*([kKmM])?\s*(?:-|–|—|to)\s*(\d[\d,.\s]*)\s*([kKmM])?/i;

const CONCAT_GARBAGE_PATTERN =
  /[a-z]Campaign\b|Campaign\s*Duration|CampaignDuration|EgyptCampaign/i;

const SENTENCE_FRAGMENT_START = /^(and|or|the|to|for|with|in|on|at|by|a|an)\s+/i;
const OBJECTIVE_VERB_START =
  /^(and\s+)?(amplify|drive|launch|increase|boost|engage|promote|build|create|deliver|support|grow|maximize|enhance|leverage|expand)\b/i;
const CAMPAIGN_TAGLINE_PATTERN = /\b(summer|winter|spring|fall|autumn|q[1-4])\s+20\d{2}\b/i;
const BRAND_STOPWORDS_IN_NAME =
  /\b(campaign|objective|awareness|engagement|launch|amplify|targeting|creator|influencer|brief|strategy)\b/i;

/** Strip field-label bleed from adjacent docx rows (e.g. "Paris" + "Market" → "ParisMa"). */
export function sanitizeBrandName(value: string): string {
  let v = value.trim();
  if (!v) return v;

  v = v.replace(/ParisMa(?:rket)?$/i, "Paris");
  v = v.replace(/([a-z])(Ma(?:rket)?)$/i, "$1");

  return v.trim();
}

/** Reject sentence fragments and campaign copy misclassified as brand names. */
export function isValidBrandName(value: string): boolean {
  const v = sanitizeBrandName(value);
  if (!v || v.length < 2) return false;
  if (isConcatenatedGarbage(v)) return false;
  if (SENTENCE_FRAGMENT_START.test(v)) return false;
  if (OBJECTIVE_VERB_START.test(v)) return false;
  if (v.length > 45) return false;

  const words = v.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;

  const hasCampaignTagline = CAMPAIGN_TAGLINE_PATTERN.test(v);
  const hasKnownBrandToken =
    /\betisalat\b/i.test(v) ||
    /\be\s*&\b/i.test(v) ||
    /\bl['']?or[eé]al\b/i.test(v) ||
    /^e&$/i.test(v);

  if (hasCampaignTagline && !hasKnownBrandToken) return false;
  if (BRAND_STOPWORDS_IN_NAME.test(v) && words.length > 2 && !hasKnownBrandToken) return false;

  return true;
}

export function isConcatenatedGarbage(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (CONCAT_GARBAGE_PATTERN.test(v)) return true;
  if (FIELD_LABEL_FRAGMENTS.some((frag) => v.toLowerCase().includes(frag))) return true;
  if (
    /(audience|objective|deliverable|budget|duration|platform|keyword).*(audience|objective|deliverable|budget|duration|platform|keyword)/i.test(
      v
    )
  ) {
    return true;
  }
  return false;
}

export function isBadCategoryToken(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (BAD_CATEGORY_TOKENS.includes(normalized as (typeof BAD_CATEGORY_TOKENS)[number])) {
    return true;
  }
  if (/campaign\s*duration/i.test(normalized)) return true;
  if (/\b(audience|objective|deliverable|budget|duration)\b/i.test(normalized)) return true;
  return false;
}

export function isValidKeyword(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 40) return false;
  if (isConcatenatedGarbage(v)) return false;
  if (/^(audience|campaign|objective|deliverable|budget|duration|platform|keyword)\s*[:]/i.test(v)) {
    return false;
  }
  return true;
}

export function isValidCategory(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 2 || v.length > 50) return false;
  if (isConcatenatedGarbage(v)) return false;
  if (isBadCategoryToken(v)) return false;
  if (QUICK_CATEGORIES.some((c) => c.toLowerCase() === v.toLowerCase())) return true;
  if (NICHE_PATTERNS.some((p) => p.test(v))) return true;
  if (/^\d+$/.test(v)) return false;
  if (FOLLOWER_RANGE_PATTERN.test(v)) return false;
  if (/follower/i.test(v)) return false;
  return true;
}

export function isValidNiche(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 2 || v.length > 60) return false;
  if (isConcatenatedGarbage(v)) return false;
  if (isBadCategoryToken(v)) return false;
  if (FOLLOWER_RANGE_PATTERN.test(v)) return false;
  return true;
}

export function isValidCity(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 2 || v.length > 60) return false;
  if (isConcatenatedGarbage(v)) return false;
  return true;
}

export function resolveCountryCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || isConcatenatedGarbage(trimmed)) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return COUNTRY_OPTIONS.some((o) => o.value === code) ? code : null;
  }

  const paren = trimmed.match(/\(([A-Za-z]{2})\)\s*$/);
  if (paren) {
    const code = paren[1].toUpperCase();
    return COUNTRY_OPTIONS.some((o) => o.value === code) ? code : null;
  }

  const exact = COUNTRY_OPTIONS.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.value;

  const lower = trimmed.toLowerCase();
  for (const opt of COUNTRY_OPTIONS) {
    const label = opt.label.toLowerCase();
    if (lower.startsWith(label) && lower.length > label.length) {
      const remainder = lower.slice(label.length);
      if (/^campaign|^duration|^objective/i.test(remainder)) return null;
    }
  }

  const partial = COUNTRY_OPTIONS.find(
    (o) =>
      o.label.toLowerCase() === lower ||
      (lower.length >= 4 && o.label.toLowerCase().startsWith(lower))
  );
  return partial?.value ?? null;
}

export function countryLabel(code: string): string {
  return COUNTRY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function normalizePlatform(raw: string): DiscoveryPlatform | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("instagram") || v === "ig") return "instagram";
  if (v.includes("tiktok") || v === "tt") return "tiktok";
  if (v.includes("youtube") || v === "yt") return "youtube";
  if (v.includes("twitter") || v === "x") return "twitter";
  if ((DISCOVERY_PLATFORMS as readonly string[]).includes(v)) return v as DiscoveryPlatform;
  return null;
}

export function normalizeGender(raw: string): NormalizedGender | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "any" || v === "all") return "any";
  if (v.includes("female") || v === "f" || v === "women" || v === "woman") return "female";
  if ((v.includes("male") && !v.includes("female")) || v === "m" || v === "men" || v === "man") {
    return "male";
  }
  return null;
}

export function parseFollowerToken(token: string): number | null {
  const cleaned = token.replace(/,/g, "").trim().toLowerCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  if (match[2] === "k") return Math.round(base * 1_000);
  if (match[2] === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

export function parseFollowerRange(text: string): { min?: number; max?: number } | null {
  const match = text.match(FOLLOWER_RANGE_PATTERN);
  if (!match) return null;
  const min = parseFollowerToken(`${match[1]}${match[2] ?? ""}`);
  const max = parseFollowerToken(`${match[3]}${match[4] ?? ""}`);
  if (min == null && max == null) return null;
  return { min: min ?? undefined, max: max ?? undefined };
}

export function parseEngagementPercent(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : null;
}

export function pushIssue(
  issues: ExtractionIssue[],
  field: string,
  rawValue: string,
  reason: string,
  severity: ExtractionIssue["severity"] = "error"
): void {
  const trimmed = rawValue.trim();
  if (!trimmed) return;
  const duplicate = issues.some(
    (i) => i.field === field && i.rawValue === trimmed && i.reason === reason
  );
  if (!duplicate) {
    issues.push({ field, rawValue: trimmed, reason, severity });
  }
}

export function canonicalizeCategory(value: string): string | null {
  if (!isValidCategory(value)) return null;
  const match = QUICK_CATEGORIES.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return match ?? value.trim();
}
