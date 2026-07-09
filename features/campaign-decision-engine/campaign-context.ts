/**
 * Read-only extraction from immutable CampaignObject into decision context.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  isBudgetSectionData,
  isPerformanceSectionData,
  isSummarySectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  resolveBudgetData,
  resolveCampaignSummary,
  resolveContentPlan,
  resolveCreatorIds,
  resolveGroundedKpis,
  resolveSuccessProbability,
  resolveTimelineData,
} from "@/features/campaign-studio/services/section-data-resolver";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CreatorDNADocument } from "@/features/creator-dna/types";

import { normalizeInfluencerLookupId } from "./client-creator-identity";

import type {
  CampaignDecisionContext,
  KpiSnapshot,
  SimulationBudget,
  SimulationCreator,
  SimulationRisk,
  SimulationTimeline,
} from "./decision-types";

function parseNumericValue(text: string | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseKpiNumber(kpiText: string): number {
  const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  const normalized = kpiText.toLowerCase().replace(/,/g, "").trim();
  const match = normalized.match(/^([\d.]+)\s*([kmb])?/);
  if (!match) return parseNumericValue(normalized);
  const base = parseFloat(match[1]);
  const mult = match[2] ? multipliers[match[2]] : 1;
  return base * mult;
}

function extractKpisFromCampaign(campaignObject: CampaignObject): Partial<KpiSnapshot> {
  const grounded = resolveGroundedKpis(campaignObject);
  const perfData = isPerformanceSectionData(campaignObject.sections.performance.data)
    ? campaignObject.sections.performance.data
    : null;
  const summary = resolveCampaignSummary(campaignObject);
  const partial: Partial<KpiSnapshot> = {};

  for (const kpi of grounded) {
    const metric = kpi.metric.toLowerCase();
    const val = parseKpiNumber(kpi.prediction);
    if (metric.includes("reach") || metric.includes("impression")) {
      partial.reach = Math.max(partial.reach ?? 0, val);
      partial.impressions = Math.max(partial.impressions ?? 0, val);
    }
    if (metric.includes("engagement rate") || metric.includes("er")) {
      partial.engagementRate = val <= 1 ? val * 100 : val;
    }
    if (metric.includes("engagement") && !metric.includes("rate")) {
      partial.engagement = val;
    }
    if (metric.includes("conversion") || metric.includes("lead")) {
      partial.conversions = val;
    }
    if (metric.includes("awareness")) {
      partial.awareness = val <= 1 ? val * 100 : val;
    }
    if (metric.includes("cpm")) {
      partial.cpm = val;
    }
    if (metric.includes("roas")) {
      partial.roas = val;
    }
  }

  if (summary?.estimatedReach) {
    const reach = parseKpiNumber(summary.estimatedReach);
    if (reach > 0) {
      partial.reach = reach;
      partial.impressions = reach;
    }
  }

  const benchmark = perfData?.industryBenchmark;
  if (benchmark?.estCpm && !partial.cpm) {
    partial.cpm = parseKpiNumber(benchmark.estCpm);
  }
  if (benchmark?.estReach && !partial.reach) {
    partial.reach = parseKpiNumber(benchmark.estReach);
    partial.impressions = partial.reach;
  }

  return partial;
}

function defaultKpisForIndustry(industry: string, budgetTotal: number): KpiSnapshot {
  const industryFactors: Record<string, { reachPerDollar: number; er: number; cpm: number }> = {
    baby: { reachPerDollar: 1.5, er: 5.5, cpm: 45 },
    sport: { reachPerDollar: 1.2, er: 4.2, cpm: 55 },
    luxury: { reachPerDollar: 0.4, er: 2.8, cpm: 120 },
    tourism: { reachPerDollar: 1.0, er: 4.8, cpm: 38 },
    finance: { reachPerDollar: 0.6, er: 3.1, cpm: 85 },
    default: { reachPerDollar: 0.8, er: 4.0, cpm: 50 },
  };

  const key = industry.includes("baby")
    ? "baby"
    : industry.includes("sport") || industry.includes("adidas")
      ? "sport"
      : industry.includes("luxury") || industry.includes("rolex")
        ? "luxury"
        : industry.includes("tourism") || industry.includes("travel")
          ? "tourism"
          : industry.includes("finance") || industry.includes("bank")
            ? "finance"
            : "default";

  const factor = industryFactors[key];
  const reach = Math.round(budgetTotal * factor.reachPerDollar);
  const er = factor.er;
  const engagement = Math.round(reach * (er / 100));
  const cpm = factor.cpm;

  return {
    reach,
    engagement,
    engagementRate: er,
    impressions: reach,
    awareness: Math.min(95, Math.round((reach / 10_000_000) * 100)),
    cpm,
    cpe: cpm * 0.15,
    roas: key === "finance" ? 2.4 : key === "luxury" ? 1.8 : 3.2,
    conversions: Math.round(reach * 0.002),
    creatorCount: 0,
    postCount: 0,
  };
}

function resolveCreatorDisplayNames(campaignObject: CampaignObject): Map<string, string> {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const names = new Map<string, string>();

  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    const displayName = entry.displayName?.trim();
    if (!displayName) continue;

    names.set(entry.creatorId, displayName);
    const normalized = normalizeInfluencerLookupId(entry.creatorId);
    names.set(normalized, displayName);
    if (!entry.creatorId.startsWith("inf:")) {
      names.set(`inf:${normalized}`, displayName);
    }
  }

  return names;
}

function buildCreatorsFromCampaign(
  campaignObject: CampaignObject,
  dnaMap?: Map<string, CreatorDNADocument>
): SimulationCreator[] {
  const { ids } = resolveCreatorIds(campaignObject);
  const displayNames = resolveCreatorDisplayNames(campaignObject);
  const contentPlan = resolveContentPlan(campaignObject);
  const postCountByCreator = new Map<string, number>();

  for (const item of contentPlan) {
    const tier = item.creatorTier.toLowerCase();
    for (const id of ids) {
      if (tier.includes(id.slice(-4)) || ids.length === 1) {
        postCountByCreator.set(id, (postCountByCreator.get(id) ?? 0) + item.quantity);
      }
    }
  }

  const defaultPosts = Math.max(1, Math.ceil(contentPlan.length / Math.max(ids.length, 1)));

  return ids.map((id, index) => {
    const dna = dnaMap?.get(id);
    const followers = dna?.metrics.followers.value ?? 80_000 + index * 35_000;
    const er = dna?.metrics.engagementRate.value ?? 4.5 - index * 0.3;
    const platform = dna?.identity.platform.value ?? (index % 2 === 0 ? "instagram" : "tiktok");
    const fitScore = dna?.scores.brandFit.value ?? dna?.scores.thinkwayScore.value ?? 72 - index * 5;
    const cpm = followers > 500_000 ? 95 : followers > 200_000 ? 65 : 42;
    const storedName =
      displayNames.get(id) ??
      displayNames.get(normalizeInfluencerLookupId(id));

    return {
      id,
      handle: dna?.identity.handle.value ?? `creator_${index + 1}`,
      displayName:
        dna?.identity.displayName.value ?? storedName ?? `Creator ${index + 1}`,
      platform,
      followers,
      engagementRate: er ?? 4.5,
      postCount: postCountByCreator.get(id) ?? defaultPosts,
      fitScore: fitScore ?? 70,
      source: "thinkway" as const,
      cpm,
    };
  });
}

function extractBudget(campaignObject: CampaignObject): SimulationBudget {
  const resolved = resolveBudgetData(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);
  const currency = resolved?.currency ?? "USD";

  let total = resolved?.total ?? 0;
  if (!total && resolved?.allocations.length) {
    total = resolved.allocations.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  }
  if (!total && summary?.budget) {
    total = parseKpiNumber(summary.budget);
  }
  if (!total && isBudgetSectionData(campaignObject.sections.budget.content)) {
    total = campaignObject.sections.budget.content.total ?? 0;
  }

  const creatorFees =
    resolved?.allocations.find((a) => /creator|influencer|vendor/i.test(a.category))?.amount ??
    Math.round(total * 0.62);
  const production =
    resolved?.allocations.find((a) => /production|content/i.test(a.category))?.amount ??
    Math.round(total * 0.28);
  const contingency =
    resolved?.allocations.find((a) => /contingency/i.test(a.category))?.amount ??
    Math.round(total * 0.1);

  return { currency, total, creatorFees, production, contingency };
}

function extractTimeline(campaignObject: CampaignObject): SimulationTimeline {
  const timeline = resolveTimelineData(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);
  const durationWeeks =
    timeline?.durationWeeks ??
    (summary?.duration ? parseInt(summary.duration, 10) : 6);
  const goLiveWeek = timeline?.goLiveWeek ?? Math.max(1, durationWeeks - 1);

  return { durationWeeks, goLiveWeek };
}

function extractRisk(campaignObject: CampaignObject): SimulationRisk {
  const success = resolveSuccessProbability(campaignObject);
  const weaknesses = success?.weaknesses ?? [];
  const risks = success?.risks ?? [];
  const highRiskCount = risks.length + weaknesses.filter((w) => /high|critical/i.test(w)).length;

  const score = success?.score ?? 70;
  const level: SimulationRisk["level"] =
    score >= 75 ? "low" : score >= 55 ? "medium" : "high";

  return {
    level,
    score: Math.max(0, 100 - highRiskCount * 12),
    highRiskCount,
    factors: [...risks, ...weaknesses].slice(0, 5),
  };
}

function extractPlatforms(campaignObject: CampaignObject): string[] {
  const summary = resolveCampaignSummary(campaignObject);
  const contentPlan = resolveContentPlan(campaignObject);

  const fromSummary = summary?.platforms
    ? summary.platforms.split(/[,/&+]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
    : [];

  const fromPlan = [...new Set(contentPlan.map((item) => item.platform.toLowerCase()))];

  const combined = [...new Set([...fromSummary, ...fromPlan])];
  return combined.length > 0 ? combined : ["instagram", "tiktok"];
}

/** Read-only projection of CampaignObject into decision simulation context. */
export function extractCampaignDecisionContext(
  campaignObject: CampaignObject,
  creatorDna?: Map<string, CreatorDNADocument>
): CampaignDecisionContext {
  const summaryCards = campaignObject.sections.summary.data?.summaryCards;
  const summary = isSummarySectionData(summaryCards) ? summaryCards : resolveCampaignSummary(campaignObject);
  const briefText = [
    summary?.objective,
    summary?.brand,
    summary?.market,
    campaignObject.sections.summary.content,
  ]
    .filter((v) => typeof v === "string")
    .join("\n");

  const industry = detectIndustryFromBrief(briefText);
  const budget = extractBudget(campaignObject);
  const creators = buildCreatorsFromCampaign(campaignObject, creatorDna);
  const timeline = extractTimeline(campaignObject);
  const risk = extractRisk(campaignObject);
  const success = resolveSuccessProbability(campaignObject);

  const kpiPartial = extractKpisFromCampaign(campaignObject);
  const defaults = defaultKpisForIndustry(industry, budget.total);
  const kpis: KpiSnapshot = {
    ...defaults,
    ...kpiPartial,
    creatorCount: creators.length,
    postCount: creators.reduce((sum, c) => sum + c.postCount, 0),
  };

  if (creators.length > 0 && (!kpiPartial.reach || kpiPartial.reach === defaults.reach)) {
    const creatorReach = creators.reduce(
      (sum, c) => sum + c.followers * c.postCount * 0.35,
      0
    );
    kpis.reach = Math.round(Math.max(kpis.reach, creatorReach));
    kpis.impressions = kpis.reach;
    kpis.engagement = Math.round(kpis.reach * (kpis.engagementRate / 100));
  }

  return {
    campaignObjectId: campaignObject.id,
    brand: summary?.brand,
    objective: summary?.objective,
    market: summary?.market,
    currency: budget.currency,
    budget,
    kpis,
    creators,
    timeline,
    risk,
    successProbability: success?.score ?? 70,
    platforms: extractPlatforms(campaignObject),
    industry,
  };
}

/** Verify CampaignObject was not mutated (deep JSON equality). */
export function assertCampaignObjectImmutable(
  before: CampaignObject,
  after: CampaignObject
): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

/** Deep-freeze for runtime immutability checks in validation. */
export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }
  return obj;
}

/** Snapshot CampaignObject for before/after comparison. */
export function snapshotCampaignObject(campaignObject: CampaignObject): string {
  return JSON.stringify(campaignObject);
}
