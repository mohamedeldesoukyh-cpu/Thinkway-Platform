import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import type {
  BudgetSectionData,
  CreatorMixTier,
  GroundedKpi,
  SummarySectionData,
  TimelineSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  buildSingleCreatorFeesAllocation,
  deriveInfluencerBudgetAllocations,
} from "@/features/campaign-studio/services/budget-allocation";
import {
  detectIndustryFromBrief,
  resolveIndustryFromLabel,
} from "@/features/campaign-studio/services/industry-intelligence";
import { getIndustryCreatorMix } from "@/features/campaign-studio/services/creator-tier-mix-by-industry";
import {
  creatorTierPreferenceFromFacts,
  resolveCreatorTierMixFromPreference,
  type CreatorTierMixBasis,
} from "./creator-tier-preference";
import {
  clampCampaignDurationWeeks,
  resolveGoLiveWeek,
} from "@/features/campaign-studio/services/timeline-duration";

import {
  briefRequiresOptionalCategories,
  buildDirectorBudgetFromStrategy,
  defaultCreatorFeesRationale,
} from "../services/budget-rules";
import { buildClientTimelineFromStrategy } from "../services/timeline-rules";
import type { CampaignStrategyDocument } from "../types";
import {
  formatCampaignDateLabel,
  resolveCampaignEndDate,
} from "@/features/campaign-outputs/media-plan-week-start";

import type { CampaignFacts } from "./campaign-facts-types";

export function getCampaignFacts(
  campaignObject?: Pick<CampaignObject, "meta"> | null
): CampaignFacts | undefined {
  return campaignObject?.meta.campaignFacts;
}

export function hasCampaignFacts(
  campaignObject?: Pick<CampaignObject, "meta"> | null
): boolean {
  return Boolean(getCampaignFacts(campaignObject));
}

export function getCampaignFactsFromState(
  stateData: Record<string, unknown>
): CampaignFacts | undefined {
  return stateData.campaignFacts as CampaignFacts | undefined;
}

/** Prefer facts-derived value; fall back to legacy resolver when facts absent. */
export function getCampaignFactsOrLegacy<T>(
  campaignObject: Pick<CampaignObject, "meta"> | undefined | null,
  fromFacts: (facts: CampaignFacts) => T | undefined,
  legacyFallback: () => T
): T {
  const facts = getCampaignFacts(campaignObject);
  if (facts) {
    const value = fromFacts(facts);
    if (value !== undefined) return value;
  }
  return legacyFallback();
}

export function resolveFactsBudgetTotal(facts: CampaignFacts): number | undefined {
  return facts.budget?.amount;
}

export function resolveFactsCurrency(facts: CampaignFacts): string {
  return facts.budget?.currency ?? "USD";
}

const LOCAL_INFLUENCER_FEE_CURRENCIES = new Set(["EGP", "AED", "SAR"]);
const MENA_GEOGRAPHY_PATTERN =
  /egypt|mena|cairo|uae|dubai|saudi|riyadh|jordan|kuwait|qatar|bahrain|oman|emirates/i;

/** Currency for creator post-fee estimates — benchmarks are MENA rate cards (EGP-native). */
export function resolveInfluencerEstimateCurrency(
  facts?: Pick<CampaignFacts, "budget" | "geography">
): string {
  const budgetCurrency = facts?.budget?.currency?.trim().toUpperCase();
  if (budgetCurrency && LOCAL_INFLUENCER_FEE_CURRENCIES.has(budgetCurrency)) {
    return budgetCurrency;
  }

  const geographyText = facts?.geography?.join(" ") ?? "";
  if (MENA_GEOGRAPHY_PATTERN.test(geographyText)) {
    return "EGP";
  }

  return "EGP";
}

export function resolveFactsDurationWeeks(facts: CampaignFacts): number | undefined {
  if (facts.durationWeeks == null) return undefined;
  return clampCampaignDurationWeeks(facts.durationWeeks);
}

export function resolveFactsBrandName(facts: CampaignFacts): string | undefined {
  return facts.brandName;
}

export function resolveFactsClientName(facts: CampaignFacts): string | undefined {
  return facts.clientName ?? facts.brandName;
}

export function resolveFactsObjective(facts: CampaignFacts): string | undefined {
  return facts.objective;
}

export function formatFactsBudgetDisplay(facts: CampaignFacts): string | undefined {
  const amount = facts.budget?.amount;
  if (amount == null) return undefined;
  return `${amount.toLocaleString()} ${resolveFactsCurrency(facts)}`;
}

export function formatFactsDurationDisplay(facts: CampaignFacts): string | undefined {
  const weeks = resolveFactsDurationWeeks(facts);
  if (weeks == null) return undefined;
  return `${weeks} weeks`;
}

function normalizeCreatorTier(tier: string): CreatorMixTier["tier"] {
  const lower = tier.toLowerCase();
  if (lower === "celebrity") return "Celebrity";
  if (lower === "mega") return "Mega";
  if (lower === "macro") return "Macro";
  if (lower === "mid" || lower === "mid-tier") return "Mid";
  if (lower === "micro") return "Micro";
  if (lower === "nano") return "Nano";
  return "Macro";
}

/** Merge duplicate tier labels after normalization. */
export function dedupeCreatorMixTiers(tiers: CreatorMixTier[]): CreatorMixTier[] {
  const merged = new Map<CreatorMixTier["tier"], CreatorMixTier>();
  const order: CreatorMixTier["tier"][] = [];

  for (const tier of tiers) {
    const existing = merged.get(tier.tier);
    if (!existing) {
      merged.set(tier.tier, { ...tier });
      order.push(tier.tier);
      continue;
    }
    merged.set(tier.tier, {
      tier: tier.tier,
      percent: existing.percent + tier.percent,
      count: existing.count + tier.count,
      reasoning: [existing.reasoning, tier.reasoning].filter(Boolean).join(" "),
    });
  }

  return order.map((tier) => merged.get(tier)!);
}

export function creatorTierStrategyToMix(
  tiers: Array<{ tier: string; allocationPercent: number; why: string }>
): CreatorMixTier[] {
  return dedupeCreatorMixTiers(
    tiers
      .filter((t) => t.allocationPercent > 0)
      .map((t) => ({
        tier: normalizeCreatorTier(t.tier),
        count: Math.max(1, Math.round(t.allocationPercent / 10)),
        percent: t.allocationPercent,
        reasoning: t.why,
      }))
  );
}

export function buildCreatorMixFromReasoningTiers(
  tiers: Array<{ tier: string; percent: number; whyThisTier: string }>
): CreatorMixTier[] {
  return dedupeCreatorMixTiers(
    tiers.map((r) => ({
      tier: normalizeCreatorTier(r.tier),
      count: Math.max(1, Math.round(r.percent / 10)),
      percent: r.percent,
      reasoning: r.whyThisTier,
    }))
  );
}

/**
 * The tier mix for a campaign, and how it was arrived at.
 *
 * The brief comes first. Two hardcoded industry ladders used to live here and
 * in `strategy-document`, each with four branches and the same universal
 * `Macro 40 / Micro 35 / Nano 25` for everything else — which is why unrelated
 * campaigns all showed 40/35/25 and a brief asking for Macro/Mid/Micro was
 * ignored. Both now read the one industry table
 * (`getIndustryCreatorMix`) and apply the brief's stated preference over it.
 */
export function resolveCreatorTierMixFromFacts(facts: CampaignFacts): {
  mix: CreatorMixTier[];
  basis: CreatorTierMixBasis;
} {
  // The stored `industry` is the canonical LABEL, so resolve it as one; only
  // fall back to signal detection when it is something else (or absent).
  const industry =
    resolveIndustryFromLabel(facts.industry) ??
    detectIndustryFromBrief(facts.industry ?? facts.brandName ?? "");

  const baseMix = getIndustryCreatorMix(industry, facts.rawBriefExcerpt).filter(
    (tier) => tier.percent > 0 || (tier.count ?? 0) > 0
  );

  return resolveCreatorTierMixFromPreference({
    preference: creatorTierPreferenceFromFacts(facts),
    baseMix,
  });
}

/** Derive creator mix tiers from the brief's preference, else the industry mix. */
export function buildCreatorMixFromFacts(facts: CampaignFacts): CreatorMixTier[] {
  return resolveCreatorTierMixFromFacts(facts).mix;
}

export function buildGroundedKpisFromFacts(facts: CampaignFacts): GroundedKpi[] {
  if (!facts.kpis?.length) return [];

  return facts.kpis.map((kpi, index) => {
    const colon = kpi.indexOf(":");
    const metric = colon > 0 ? kpi.slice(0, colon).trim() : kpi.trim();
    const target = colon > 0 ? kpi.slice(colon + 1).trim() : "Per brief";

    return {
      metric,
      prediction: target,
      confidence: facts.confidence?.kpis ?? 85,
      reason: "Extracted from campaign facts SSOT",
      calculationSource: "CampaignFacts.kpis",
      platform: facts.platforms?.[index % (facts.platforms?.length ?? 1)],
    };
  });
}

export function buildGroundedKpisFromStrategy(
  strategy: CampaignStrategyDocument
): GroundedKpi[] {
  const kpis = strategy.understanding.kpis ?? [];
  if (kpis.length === 0) return [];

  return kpis.map((kpi) => ({
    metric: kpi.metric,
    prediction: kpi.target,
    confidence: 85,
    reason: kpi.why ?? "From Director strategy document",
    calculationSource: "StrategyDocument.understanding.kpis",
  }));
}

export function buildBudgetSectionDataFromFacts(
  facts: CampaignFacts,
  contextText: string,
  strategy?: CampaignStrategyDocument
): BudgetSectionData {
  if (strategy) {
    return buildDirectorBudgetFromStrategy(strategy, contextText, facts);
  }

  const industry = detectIndustryFromBrief(facts.industry ?? contextText);
  const total = facts.budget?.amount;
  const currency = resolveFactsCurrency(facts);
  // Budget split decisions read the brief itself, never generated section text.
  const briefSource = facts.rawBriefExcerpt?.trim() || contextText;
  const allocations = briefRequiresOptionalCategories(briefSource, facts)
    ? deriveInfluencerBudgetAllocations(industry, briefSource, total)
    : buildSingleCreatorFeesAllocation(
        total,
        defaultCreatorFeesRationale(briefSource, facts)
      );

  return { currency, total, allocations };
}

export function buildTimelineSectionDataFromFacts(
  facts: CampaignFacts,
  strategy?: CampaignStrategyDocument
): TimelineSectionData {
  const durationWeeks = resolveFactsDurationWeeks(facts);
  if (durationWeeks == null) {
    return { milestones: [] };
  }

  const minimalStrategy = {
    understanding: { timeline: { durationWeeks } },
  } as CampaignStrategyDocument;

  const clientWeeks = buildClientTimelineFromStrategy(
    strategy ?? minimalStrategy
  );

  return {
    durationWeeks,
    goLiveWeek: resolveGoLiveWeek(durationWeeks),
    milestones: clientWeeks.map((w) => ({
      week: w.week,
      phase: w.phase,
      activities: w.activities,
      status: "pending" as const,
    })),
  };
}

/** Merge facts into summary cards — facts fields take precedence over parsed text. */
export function applyFactsToSummaryData(
  data: SummarySectionData,
  facts: CampaignFacts
): SummarySectionData {
  const result = { ...data };

  const client = resolveFactsClientName(facts);
  if (client) result.client = client;

  const brand = resolveFactsBrandName(facts);
  if (brand) result.brand = brand;

  if (facts.product) result.product = facts.product;

  const objective = resolveFactsObjective(facts);
  if (objective) result.objective = objective;

  const budgetDisplay = formatFactsBudgetDisplay(facts);
  if (budgetDisplay) result.budget = budgetDisplay;

  const durationDisplay = formatFactsDurationDisplay(facts);
  if (durationDisplay) result.duration = durationDisplay;
  else delete result.duration;

  const startIso =
    facts.requestedStartDate?.trim() || facts.campaignStartDate?.trim() || "";
  const durationWeeks = resolveFactsDurationWeeks(facts);
  const explicitEndIso = facts.campaignEndDate?.trim() || "";

  if (startIso) {
    result.campaignStartDate = formatCampaignDateLabel(startIso);
    // Prefer explicit Campaign End Date when present; otherwise derive from duration.
    const resolvedEnd =
      explicitEndIso ||
      (durationWeeks != null ? resolveCampaignEndDate(startIso, durationWeeks) : null);
    if (resolvedEnd) {
      result.campaignEndDate = formatCampaignDateLabel(resolvedEnd);
    } else {
      delete result.campaignEndDate;
    }
  } else {
    delete result.campaignStartDate;
    delete result.campaignEndDate;
  }
  // Drop legacy scheduling-detail cards if still present on older objects.
  delete (result as Record<string, unknown>).publishingCalendarStart;
  delete (result as Record<string, unknown>).calendarAlignmentNote;

  if (facts.platforms?.length) {
    result.platforms = facts.platforms.join(", ");
  }

  if (facts.audience) {
    result.targetAudience = facts.audience;
  }

  if (facts.geography?.length) {
    result.market = facts.geography.join(", ");
  }

  if (facts.deliverables?.length) {
    result.deliverables = facts.deliverables.join(", ");
  }

  return result;
}

export function applyFactsToSummaryDataOrLegacy(
  data: SummarySectionData,
  campaignObject?: Pick<CampaignObject, "meta"> | null
): SummarySectionData {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return data;
  return applyFactsToSummaryData(data, facts);
}
