import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import type {
  CreatorMixTier,
  GroundedKpi,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";

/**
 * Client-safe rendering primitives shared by Studio, Presentation, PDF, and
 * PowerPoint. Every surface must derive slate reach, celebrity gating, and
 * client-facing copy through this module so the four outputs cannot diverge.
 *
 * Layering: this module must never import section-data-resolver (the resolver
 * imports these helpers).
 */

export type SlateCreatorInput = {
  displayName?: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  tier?: string | null;
  role?: string | null;
};

export type SlateReachEstimate = {
  low: number;
  high: number;
  formattedRange: string;
  totalFollowers: number;
  creatorCount: number;
  excludedCreatorCount: number;
  assumptions: string[];
};

/** Organic per-post reach as a share of follower base, by platform. */
const PLATFORM_REACH_RATES: Record<string, { low: number; high: number }> = {
  instagram: { low: 0.2, high: 0.35 },
  tiktok: { low: 0.25, high: 0.5 },
  youtube: { low: 0.1, high: 0.25 },
  facebook: { low: 0.08, high: 0.18 },
  snapchat: { low: 0.15, high: 0.3 },
  linkedin: { low: 0.05, high: 0.12 },
};

const DEFAULT_REACH_RATE = { low: 0.15, high: 0.3 };

function reachRateForPlatform(platform?: string): { low: number; high: number } {
  const key = platform?.trim().toLowerCase() ?? "";
  return PLATFORM_REACH_RATES[key] ?? DEFAULT_REACH_RATE;
}

export function formatReachValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${rounded}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

function describeRateAssumption(platforms: Set<string>): string {
  const parts: string[] = [];
  for (const platform of platforms) {
    const rate = PLATFORM_REACH_RATES[platform];
    if (!rate) continue;
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    parts.push(`${label} ${Math.round(rate.low * 100)}–${Math.round(rate.high * 100)}%`);
  }
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `Assumes organic per-post reach as a share of each creator's follower base, by platform${detail}.`;
}

/**
 * Estimated reach computed from the selected creator slate. Returns null when
 * no selected creator has follower data — surfaces must then state that the
 * estimate is pending creator selection instead of showing a fabricated range.
 */
export function estimateSlateReach(
  creators: SlateCreatorInput[]
): SlateReachEstimate | null {
  const withFollowers = creators.filter(
    (creator) => creator.followers != null && creator.followers > 0
  );
  if (withFollowers.length === 0) return null;

  let low = 0;
  let high = 0;
  let totalFollowers = 0;
  const platforms = new Set<string>();

  for (const creator of withFollowers) {
    const followers = creator.followers!;
    const rate = reachRateForPlatform(creator.platform);
    low += followers * rate.low;
    high += followers * rate.high;
    totalFollowers += followers;
    const platformKey = creator.platform?.trim().toLowerCase();
    if (platformKey) platforms.add(platformKey);
  }

  const excludedCreatorCount = creators.length - withFollowers.length;
  const assumptions = [
    `Modeled from ${withFollowers.length} selected creator${withFollowers.length === 1 ? "" : "s"} with a combined follower base of ${formatReachValue(totalFollowers)}.`,
    describeRateAssumption(platforms),
    "Single-post baseline per creator; repeat posting and paid amplification would increase delivered reach.",
  ];
  if (excludedCreatorCount > 0) {
    assumptions.push(
      `${excludedCreatorCount} creator${excludedCreatorCount === 1 ? "" : "s"} without verified follower data excluded from the model.`
    );
  }

  return {
    low: Math.round(low),
    high: Math.round(high),
    formattedRange: `${formatReachValue(low)}–${formatReachValue(high)} estimated reach`,
    totalFollowers,
    creatorCount: withFollowers.length,
    excludedCreatorCount,
    assumptions,
  };
}

/** Legacy hardcoded industry reach ranges — never render these as campaign facts. */
const LEGACY_TEMPLATE_REACH_PATTERN =
  /qualified impressions|cross-platform views|parents reached|campaign impressions|qualified reach|estimated reach$/i;

/** Drop persisted reach values that came from the retired industry templates. */
export function sanitizeLegacyReachValue(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  if (LEGACY_TEMPLATE_REACH_PATTERN.test(value.trim())) return undefined;
  return value;
}

export function isCelebrityCreator(creator: SlateCreatorInput): boolean {
  if (creator.tier === "Celebrity") return true;
  return (
    resolveCreatorTierLabel({
      followers: creator.followers ?? null,
      role: creator.role ?? creator.tier ?? null,
    }) === "Celebrity"
  );
}

function sectionText(content: string | Record<string, unknown> | undefined): string {
  return typeof content === "string" ? content : "";
}

/**
 * Celebrity content gate. Celebrity creators may only be referenced when the
 * campaign's own brief/facts explicitly ask for one, or a Celebrity-tier
 * creator is actually part of the selected slate. Industry templates never
 * count as a celebrity selection.
 */
export function resolveCelebrityAllowed(
  campaignObject?: CampaignObject,
  slate?: SlateCreatorInput[]
): boolean {
  if (slate?.some(isCelebrityCreator)) return true;
  if (!campaignObject) return false;

  const facts = getCampaignFacts(campaignObject);
  const briefContext = [
    facts?.rawBriefExcerpt,
    facts?.objective,
    facts?.audience,
    facts?.campaignType,
    facts?.constraints?.join(" "),
    sectionText(campaignObject.sections.summary.content),
    sectionText(campaignObject.sections.strategy.content),
  ]
    .filter(Boolean)
    .join("\n");

  return /celebrit/i.test(briefContext);
}

/** Remove Celebrity tiers and renormalize percentages when the gate is closed. */
export function filterCelebrityMixTiers(
  tiers: CreatorMixTier[],
  allowCelebrity: boolean
): CreatorMixTier[] {
  if (allowCelebrity) return tiers;
  const filtered = tiers.filter((tier) => tier.tier !== "Celebrity");
  if (filtered.length === tiers.length) return tiers;

  const totalPercent = filtered.reduce((sum, tier) => sum + tier.percent, 0);
  if (totalPercent <= 0) return filtered;

  const renormalized = filtered.map((tier) => ({
    ...tier,
    percent: Math.round((tier.percent / totalPercent) * 100),
  }));
  const drift = 100 - renormalized.reduce((sum, tier) => sum + tier.percent, 0);
  if (drift !== 0 && renormalized.length > 0) {
    renormalized[0] = { ...renormalized[0], percent: renormalized[0].percent + drift };
  }
  return renormalized;
}

/** Strip celebrity mentions from short tier-summary labels (e.g. "Macro + Celebrity"). */
export function stripCelebrityFromLabel(
  label: string,
  allowCelebrity: boolean
): string {
  if (allowCelebrity || !/celebrit/i.test(label)) return label;
  return label
    .replace(/\s*\+\s*Celebrity/gi, "")
    .replace(/Celebrity\s*\+\s*/gi, "")
    .replace(/celebrity\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Internal-content markers that must never reach a client deliverable.
 * Used both to sanitize export copy and by regression tests as a banned list.
 */
export const INTERNAL_CONTENT_PATTERNS: RegExp[] = [
  /\btbd\b/i,
  /verification required/i,
  /verification pending/i,
  /\bcampaignfacts\b/i,
  /\bssot\b/i,
  /director (strategy|kpi|allocation|reasoning|budget|conclusion)/i,
  /strategy document/i,
  /—\s*rejected/i,
  /\brejected\b/i,
  /historical campaigns?/i,
  /\bbrand client\b/i,
  /\blorem\b/i,
  /placeholder/i,
  /\bllm\b/i,
  /\bprompt\b/i,
  /\bspecialist\b/i,
  /\bworkflow\b/i,
  /run discovery/i,
  /prepared by thinkway ai/i,
];

export function containsInternalContent(text: string): boolean {
  return INTERNAL_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Remove sentences/clauses carrying internal reasoning markers from
 * client-facing copy. Returns an empty string when nothing safe remains,
 * so callers can omit the field entirely.
 */
export function sanitizeClientFacingText(text?: string): string {
  if (!text?.trim()) return "";
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const safe = sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !containsInternalContent(sentence));
  return safe.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Placeholder brand labels that must never print on a client document. */
const PLACEHOLDER_BRAND_PATTERN = /^(brand client|campaign|draft in progress)$/i;

export function sanitizeClientBrandLabel(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || PLACEHOLDER_BRAND_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export type KpiFrameworkRow = {
  metric: string;
  target: string;
  rationale: string;
  measurement: string;
};

/**
 * Professional client-facing KPI framework built from the campaign's grounded
 * KPIs. Internal reasoning (sensitivity notes, rejected alternatives, facts
 * references) is stripped; each row states what is measured, the target, why
 * it matters, and how it is measured.
 */
export function buildKpiFramework(kpis: GroundedKpi[]): KpiFrameworkRow[] {
  return kpis
    .filter((kpi) => kpi.metric.trim() && kpi.prediction.trim())
    .map((kpi) => {
      const rationale =
        sanitizeClientFacingText(kpi.reason) ||
        "Supports the campaign objective and creator strategy.";
      const target = /^per brief$/i.test(kpi.prediction.trim())
        ? "As agreed in the campaign brief"
        : kpi.prediction.trim();
      const measurement = kpi.platform
        ? `${kpi.platform.charAt(0).toUpperCase()}${kpi.platform.slice(1)} analytics · Thinkway campaign reporting`
        : "Platform analytics · Thinkway campaign reporting";

      return {
        metric: kpi.metric.trim(),
        target: sanitizeClientFacingText(target) || target,
        rationale,
        measurement,
      };
    });
}
