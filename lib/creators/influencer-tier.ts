/**
 * Platform-wide influencer tier classification — single source of truth.
 *
 * Boundaries use exclusive upper thresholds in `getInfluencerTier`:
 * Nano < 10K, Micro < 100K, Mid < 500K, Macro < 1M, Mega < 5M, Celebrity ≥ 5M.
 */

export type InfluencerTier =
  | "Nano"
  | "Micro"
  | "Mid"
  | "Macro"
  | "Mega"
  | "Celebrity";

/** Exclusive upper follower thresholds (same semantics as getInfluencerTier). */
export const INFLUENCER_TIER_THRESHOLDS = {
  nano: 10_000,
  micro: 100_000,
  mid: 500_000,
  macro: 1_000_000,
  mega: 5_000_000,
} as const;

export type TierFilterRange = {
  id: string;
  tier: InfluencerTier;
  label: string;
  min: number;
  max?: number;
};

/** Discovery / search filter presets — inclusive min/max follower bands. */
export const TIER_FILTER_RANGES: TierFilterRange[] = [
  { id: "nano", tier: "Nano", label: "Nano · 1k–10k", min: 1_000, max: 9_999 },
  { id: "micro", tier: "Micro", label: "Micro · 10k–100k", min: 10_000, max: 99_999 },
  { id: "mid", tier: "Mid", label: "Mid · 100k–500k", min: 100_000, max: 499_999 },
  { id: "macro", tier: "Macro", label: "Macro · 500k–1M", min: 500_000, max: 999_999 },
  { id: "mega", tier: "Mega", label: "Mega · 1M–5M", min: 1_000_000, max: 4_999_999 },
  { id: "celebrity", tier: "Celebrity", label: "Celebrity · 5M+", min: 5_000_000 },
];

/** Display order: highest reach first. */
export const INFLUENCER_TIER_ORDER: InfluencerTier[] = [
  "Celebrity",
  "Mega",
  "Macro",
  "Mid",
  "Micro",
  "Nano",
];

const LEGACY_TIER_ALIASES: Record<string, InfluencerTier> = {
  celebrity: "Celebrity",
  celeb: "Celebrity",
  mega: "Mega",
  macro: "Macro",
  mid: "Mid",
  "mid-tier": "Mid",
  midtier: "Mid",
  micro: "Micro",
  nano: "Nano",
};

/** Classify follower count into a tier label. */
export function getInfluencerTier(followers: number): InfluencerTier {
  if (!Number.isFinite(followers) || followers < 0) return "Nano";
  if (followers < INFLUENCER_TIER_THRESHOLDS.nano) return "Nano";
  if (followers < INFLUENCER_TIER_THRESHOLDS.micro) return "Micro";
  if (followers < INFLUENCER_TIER_THRESHOLDS.mid) return "Mid";
  if (followers < INFLUENCER_TIER_THRESHOLDS.macro) return "Macro";
  if (followers < INFLUENCER_TIER_THRESHOLDS.mega) return "Mega";
  return "Celebrity";
}

/** Normalize free-text tier / role labels (legacy spellings included). */
export function normalizeInfluencerTier(input: string | null | undefined): InfluencerTier | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const alias = LEGACY_TIER_ALIASES[lower];
  if (alias) return alias;

  for (const { pattern, tier } of ROLE_TIER_PATTERNS) {
    if (pattern.test(trimmed)) return tier;
  }

  return null;
}

const ROLE_TIER_PATTERNS: Array<{ pattern: RegExp; tier: InfluencerTier }> = [
  { pattern: /\bcelebrit(?:y|ies)\b/i, tier: "Celebrity" },
  { pattern: /\bmega\b/i, tier: "Mega" },
  { pattern: /\bmacro\b/i, tier: "Macro" },
  { pattern: /\bmid[\s-]?tier\b/i, tier: "Mid" },
  { pattern: /\bmid\b/i, tier: "Mid" },
  { pattern: /\bmicro\b/i, tier: "Micro" },
  { pattern: /\bnano\b/i, tier: "Nano" },
];

/** UI display label — currently identical to tier name. */
export function formatTierLabel(tier: InfluencerTier): string {
  return tier;
}

/** Follower band for a tier — used by slate edits and discovery replacement search. */
export function getTierFollowerRange(tier: string): {
  minFollowers?: number;
  maxFollowers?: number;
} {
  const normalized = normalizeInfluencerTier(tier);
  if (!normalized) return {};

  const preset = TIER_FILTER_RANGES.find((entry) => entry.tier === normalized);
  if (!preset) return {};

  return {
    minFollowers: preset.min,
    ...(preset.max != null ? { maxFollowers: preset.max } : {}),
  };
}

/** True when a classified tier satisfies a strategy-mix tier name. */
export function matchesInfluencerTier(mixTier: string, tierLabel: string): boolean {
  const mix = normalizeInfluencerTier(mixTier);
  const label = normalizeInfluencerTier(tierLabel);
  if (mix && label) return mix === label;

  const mixKey = mixTier.trim().toLowerCase();
  const labelKey = tierLabel.trim().toLowerCase();
  return mixKey === labelKey;
}

/** Canonical display label for any tier/role spelling; passes through unknown roles. */
export function canonicalTierLabel(tier: string): string {
  return normalizeInfluencerTier(tier) ?? tier.trim();
}

/** Filter preset fields for discovery UI (`min`/`max` as strings). */
export function tierFilterPresetFields(
  range: TierFilterRange
): { min: string; max: string } {
  return {
    min: String(range.min),
    max: range.max != null ? String(range.max) : "",
  };
}
