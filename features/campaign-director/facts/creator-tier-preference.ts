/**
 * The creator tier preference the brief actually states.
 *
 * Nothing captured this before. `CampaignFacts` had no field for it, so a brief
 * saying "Preferred creator mix: Macro / Mid / Micro" reached Strategy as
 * nothing at all, and the mix came from an industry table or — for every
 * industry without a branch — the universal `Macro 40 / Micro 35 / Nano 25`.
 *
 * Two things are separated deliberately:
 *
 *   - the TIERS the brief named — a stated fact, authoritative;
 *   - the SPLIT between them — stated only when the brief gives percentages.
 *
 * A brief that names tiers without percentages does not get percentages
 * invented and attributed to it. The split is computed from the existing
 * industry mix restricted to those tiers, and it is labelled a recommendation.
 */

import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";

export type CreatorTierName = CreatorMixTier["tier"];

export type CreatorTierPreference = {
  tier: CreatorTierName;
  /** Only set when the brief stated a percentage for this tier. */
  percent?: number;
};

/** How the allocation in front of the operator was arrived at. */
export type CreatorTierMixBasis =
  /** The brief stated both the tiers and the split. */
  | "brief_percentages"
  /** The brief named the tiers; the split is Thinkway's recommendation. */
  | "brief_tiers_recommended_split"
  /** The brief said nothing; tiers and split are both recommendations. */
  | "recommended";

export const CREATOR_TIER_MIX_BASIS_LABEL: Record<CreatorTierMixBasis, string> = {
  brief_percentages: "Creator mix stated in the brief",
  brief_tiers_recommended_split:
    "Tiers stated in the brief · allocation recommended by Thinkway",
  recommended: "Recommended creator mix — the brief did not specify one",
};

const TIER_TOKEN = /\b(nano|micro|mid[-\s]?tier|mid|macro|mega|celebrity|celebrities)\b/gi;

function normalizeTierToken(token: string): CreatorTierName | null {
  const lower = token.toLowerCase().replace(/[-\s]+/g, "");
  if (lower === "nano") return "Nano";
  if (lower === "micro") return "Micro";
  if (lower === "mid" || lower === "midtier") return "Mid";
  if (lower === "macro") return "Macro";
  if (lower === "mega") return "Mega";
  if (lower === "celebrity" || lower === "celebrities") return "Celebrity";
  return null;
}

/**
 * A line that is about the creator mix itself, not a passing mention.
 *
 * "Macro creators balance reach" must NOT be read as a tier preference; only a
 * labelled mix/tier statement is.
 */
const MIX_LABEL =
  /(?:creator|influencer|talent)\s*(?:tier|tiers|mix|split|breakdown|allocation|profile\s*mix|levels?)|(?:tier|tiers)\s*(?:mix|split|breakdown|allocation)|preferred\s*(?:creator|influencer)\s*(?:tiers?|mix)/i;

/** A bullet continuing a labelled mix block, e.g. "- Macro — 40%". */
function isTierContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (!/^[-•*•\d.)\s]*[A-Za-z]/.test(trimmed)) return false;
  TIER_TOKEN.lastIndex = 0;
  return TIER_TOKEN.test(trimmed);
}

/** Percent attached to a tier: "Macro 40%", "Macro (40%)", "40% Macro". */
function percentFor(segment: string): number | undefined {
  const match = segment.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 100) return undefined;
  return Math.round(value);
}

function parseTierSegments(text: string): CreatorTierPreference[] {
  const out: CreatorTierPreference[] = [];
  const seen = new Set<CreatorTierName>();

  // Split on the separators briefs use BETWEEN tiers so a percentage attaches
  // to the tier it sits next to, not to the whole line. An em/en dash is not
  // one of them — briefs write "Macro — 40%", where the dash joins a tier to
  // its own percentage.
  const segments = text.split(/[,;/|]|\s+(?:and|&|\+|·)\s+|\n/);
  for (const segment of segments) {
    TIER_TOKEN.lastIndex = 0;
    const matches = [...segment.matchAll(TIER_TOKEN)];
    if (matches.length === 0) continue;
    // More than one tier in a segment means the separator was not one we split
    // on ("Macro Mid Micro"); each still counts, but a percentage in that
    // segment cannot be attributed to any single one of them.
    const percent = matches.length === 1 ? percentFor(segment) : undefined;
    for (const match of matches) {
      const tier = normalizeTierToken(match[1]!);
      if (!tier || seen.has(tier)) continue;
      seen.add(tier);
      out.push(percent != null ? { tier, percent } : { tier });
    }
  }
  return out;
}

/**
 * Read the brief's stated creator tier preference, or return [] when it does
 * not state one. Never guesses from an incidental tier mention.
 */
export function parseCreatorTierPreference(
  briefText: string | null | undefined
): CreatorTierPreference[] {
  const text = briefText?.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!MIX_LABEL.test(line)) continue;

    // Everything after the label's colon on this line — or the whole line when
    // the brief writes it without one — plus any immediately following bullet
    // lines that are themselves tier items.
    const colon = line.search(/[:：]/);
    const block: string[] = [colon >= 0 ? line.slice(colon + 1) : line];
    for (let next = index + 1; next < lines.length && next <= index + 8; next += 1) {
      if (!isTierContinuationLine(lines[next]!)) break;
      block.push(lines[next]!);
    }

    const parsed = parseTierSegments(block.join("\n"));
    // One tier alone is more likely prose ("mix leans macro") than a stated
    // mix; a preference needs at least two tiers, or one with a percentage.
    if (parsed.length >= 2 || (parsed.length === 1 && parsed[0]!.percent != null)) {
      return parsed;
    }
  }
  return [];
}

/**
 * The preference stored on Campaign Facts, in the brief's own order.
 *
 * Tier names are stored as free text (the brief's wording), so they are
 * normalized here; anything that is not a recognised tier is dropped rather
 * than guessed at.
 */
export function creatorTierPreferenceFromFacts(
  facts: { creatorTiers?: Array<{ tier: string; percent?: number }> } | null | undefined
): CreatorTierPreference[] {
  const stated = facts?.creatorTiers;
  if (!stated?.length) return [];

  const out: CreatorTierPreference[] = [];
  const seen = new Set<CreatorTierName>();
  for (const entry of stated) {
    const tier = normalizeTierToken(entry.tier ?? "");
    if (!tier || seen.has(tier)) continue;
    seen.add(tier);
    const percent =
      entry.percent != null && Number.isFinite(entry.percent) && entry.percent > 0
        ? Math.round(entry.percent)
        : undefined;
    out.push(percent != null ? { tier, percent } : { tier });
  }
  return out;
}

const TIER_ORDER: CreatorTierName[] = ["Celebrity", "Mega", "Macro", "Mid", "Micro", "Nano"];

/** Largest-remainder rounding so the stated percentages always total 100. */
function renormalize(values: Array<{ tier: CreatorTierName; weight: number }>): Map<CreatorTierName, number> {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  const result = new Map<CreatorTierName, number>();
  if (total <= 0) {
    const even = Math.floor(100 / Math.max(1, values.length));
    values.forEach((value, index) => {
      result.set(value.tier, index === 0 ? 100 - even * (values.length - 1) : even);
    });
    return result;
  }
  const exact = values.map((value) => ({ tier: value.tier, exact: (value.weight / total) * 100 }));
  let assigned = 0;
  for (const entry of exact) {
    const floor = Math.floor(entry.exact);
    result.set(entry.tier, floor);
    assigned += floor;
  }
  const remainder = [...exact]
    .sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
    .map((entry) => entry.tier);
  let left = 100 - assigned;
  for (const tier of remainder) {
    if (left <= 0) break;
    result.set(tier, (result.get(tier) ?? 0) + 1);
    left -= 1;
  }
  return result;
}

function toMixTier(tier: CreatorTierName, percent: number, reasoning: string): CreatorMixTier {
  return { tier, percent, count: Math.max(1, Math.round(percent / 10)), reasoning };
}

/**
 * The tier mix for a campaign, and how it was arrived at.
 *
 * Precedence:
 *   1. the brief's stated percentages — used exactly as stated;
 *   2. the brief's stated tiers — the recommended split is computed over
 *      exactly those tiers from `baseMix` and labelled a recommendation;
 *   3. no preference — `baseMix` as it is.
 *
 * `baseMix` is the existing industry recommendation (`getIndustryCreatorMix`)
 * or an approved Strategy allocation. This function never introduces a tier
 * the brief excluded, and never drops one the brief named.
 */
export function resolveCreatorTierMixFromPreference(input: {
  preference: CreatorTierPreference[];
  baseMix: CreatorMixTier[];
}): { mix: CreatorMixTier[]; basis: CreatorTierMixBasis } {
  const preference = input.preference.filter((entry) => entry.tier);
  const baseMix = input.baseMix.filter((tier) => tier.percent > 0 || (tier.count ?? 0) > 0);

  if (preference.length === 0) {
    return { mix: input.baseMix, basis: "recommended" };
  }

  const stated = preference.filter((entry) => entry.percent != null);
  if (stated.length === preference.length) {
    return {
      mix: preference.map((entry) =>
        toMixTier(entry.tier, entry.percent!, "Allocation stated in the brief")
      ),
      basis: "brief_percentages",
    };
  }

  // Tiers named, split not stated. Weight each named tier by what the existing
  // recommendation gives it; a named tier the recommendation does not use gets
  // the average of the named tiers that it does, so it is represented without
  // inventing a figure the brief never gave.
  const baseByTier = new Map(baseMix.map((tier) => [tier.tier, tier]));
  const known = preference
    .map((entry) => baseByTier.get(entry.tier)?.percent ?? 0)
    .filter((percent) => percent > 0);
  const fallbackWeight =
    known.length > 0 ? known.reduce((sum, percent) => sum + percent, 0) / known.length : 1;

  const weights = preference.map((entry) => ({
    tier: entry.tier,
    weight: entry.percent ?? baseByTier.get(entry.tier)?.percent ?? fallbackWeight,
  }));
  const percents = renormalize(weights);

  const ordered = [...preference].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );

  return {
    mix: ordered.map((entry) => {
      const base = baseByTier.get(entry.tier);
      const why = base?.reasoning
        ? `${base.reasoning} — recommended allocation; the brief named the tier, not the split`
        : "Recommended allocation; the brief named the tier, not the split";
      return toMixTier(entry.tier, percents.get(entry.tier) ?? 0, why);
    }),
    basis: "brief_tiers_recommended_split",
  };
}
