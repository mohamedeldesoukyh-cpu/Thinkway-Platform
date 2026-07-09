import {
  clampCampaignDurationWeeks,
  DEFAULT_CAMPAIGN_DURATION_WEEKS,
} from "@/features/campaign-studio/services/timeline-duration";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";
import { buildActivationPlan, describeActivationOrder } from "./activation-plan";
import type { CampaignOption, OptionId } from "./debate-types";

function cloneTiers(
  tiers: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  return tiers.map((t) => ({ ...t }));
}

function normalizeTiers(
  tiers: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  const total = tiers.reduce((s, t) => s + t.allocationPercent, 0);
  if (total === 100) return tiers;
  const factor = 100 / total;
  return tiers.map((t) => ({
    ...t,
    allocationPercent: Math.round(t.allocationPercent * factor),
  }));
}

function maxReachTiers(
  base: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  const hasMega = base.some((t) => /mega/i.test(t.tier));
  if (hasMega) {
    return normalizeTiers([
      { tier: "Mega", allocationPercent: 45, why: "Mega anchors mass reach for awareness peaks" },
      { tier: "Macro", allocationPercent: 35, why: "Macro sustains weekly reach velocity" },
      { tier: "Micro", allocationPercent: 15, why: "Micro fills platform-specific reach gaps" },
      { tier: "Nano", allocationPercent: 5, why: "Minimal Nano — reach-first, not UGC volume" },
    ]);
  }
  return normalizeTiers([
    { tier: "Macro", allocationPercent: 70, why: "Heavy Macro mix maximizes qualified reach" },
    { tier: "Micro", allocationPercent: 20, why: "Micro supports platform distribution" },
    { tier: "Nano", allocationPercent: 10, why: "Limited Nano for cost-efficient long-tail reach" },
  ]);
}

function balancedTiers(
  base: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  return cloneTiers(base);
}

function maxEngagementTiers(
  base: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  const hasMega = base.some((t) => /mega/i.test(t.tier));
  if (hasMega) {
    return normalizeTiers([
      { tier: "Mega", allocationPercent: 5, why: "Minimal Mega — one cultural anchor only" },
      { tier: "Macro", allocationPercent: 15, why: "Reduced Macro — engagement over reach" },
      { tier: "Micro", allocationPercent: 45, why: "Micro drives community ER and UGC volume" },
      { tier: "Nano", allocationPercent: 35, why: "Heavy Nano for authentic UGC and participation" },
    ]);
  }
  return normalizeTiers([
    { tier: "Macro", allocationPercent: 15, why: "Light Macro for credibility anchor only" },
    { tier: "Micro", allocationPercent: 45, why: "Micro tier carries engagement and UGC volume" },
    { tier: "Nano", allocationPercent: 40, why: "Heavy Nano mix maximizes peer-trust UGC" },
  ]);
}

function buildKpisForArchetype(
  base: CampaignStrategyDocument,
  archetype: "max_reach" | "balanced" | "max_engagement"
): CampaignOption["kpis"] {
  const baseKpis = base.understanding.kpis;
  if (archetype === "max_reach") {
    return [
      {
        metric: "Impressions",
        target: "2.5× category benchmark",
        why: "Reach-first option prioritizes gross impressions over engagement depth",
      },
      {
        metric: "Unique Reach",
        target: "70% of target audience",
        why: "Macro/Mega mix designed for top-of-funnel coverage",
      },
      ...baseKpis.slice(0, 1).map((k) => ({ ...k })),
    ];
  }
  if (archetype === "max_engagement") {
    return [
      {
        metric: "Engagement Rate",
        target: "≥ 5.5% blended ER",
        why: "Micro/Nano UGC focus drives peer-trust engagement over raw reach",
      },
      {
        metric: "UGC Volume",
        target: "80+ creator assets",
        why: "Heavy Nano/Micro mix maximizes authentic content library",
      },
      ...baseKpis.slice(0, 1).map((k) => ({ ...k })),
    ];
  }
  return baseKpis.map((k) => ({ ...k }));
}

function kpiPriorityList(kpis: CampaignOption["kpis"]): string[] {
  return kpis.map((k) => k.metric);
}

/** Generate 3 materially different campaign strategy options from facts + strategy SSOT. */
export function generateCampaignOptions(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): CampaignOption[] {
  const brand = facts.brandName ?? strategy.understanding.brand;
  const durationWeeks = clampCampaignDurationWeeks(
    strategy.understanding.timeline?.durationWeeks ?? facts.durationWeeks ?? DEFAULT_CAMPAIGN_DURATION_WEEKS
  );
  const objective = facts.objective ?? strategy.understanding.objective;
  const baseTiers = strategy.creatorTierStrategy;

  const burstPlan = buildActivationPlan(
    durationWeeks,
    "burst",
    "high",
    4,
    "Heavy Week 1 overlap — 70% creators launch simultaneously for awareness spike"
  );
  const evenPlan = buildActivationPlan(
    durationWeeks,
    "even",
    "moderate",
    2,
    "Even weekly rollout — steady cadence, minimal overlap between creator waves"
  );
  const rampPlan = buildActivationPlan(
    durationWeeks,
    "ramp",
    "sustained",
    2,
    "Progressive ramp — Micro/Nano onboarding builds to mid-campaign UGC peak"
  );

  const reachKpis = buildKpisForArchetype(strategy, "max_reach");
  const balancedKpis = buildKpisForArchetype(strategy, "balanced");
  const engagementKpis = buildKpisForArchetype(strategy, "max_engagement");

  const optionA: CampaignOption = {
    id: "A",
    label: "Maximum Reach",
    archetype: "max_reach",
    strategySlice: `${brand} — Maximum Reach: heavy Macro/Mega roster, burst Week 1 activation (${burstPlan.weekWeights[0]}% creators), impressions-led KPIs, higher CPM tolerance for ${objective}.`,
    creatorTierStrategy: maxReachTiers(baseTiers),
    timeline: {
      durationWeeks,
      rationale: `${durationWeeks}-week campaign — burst activation front-loads Macro/Mega for fast awareness`,
      activationOrder: describeActivationOrder(burstPlan),
      activationPlan: burstPlan,
    },
    budget: {
      creatorFeePercent: 92,
      contingencyPercent: 8,
      rationale: "92% creator fees — premium Macro/Mega fees consume majority; minimal contingency for burst model",
    },
    kpis: reachKpis,
    kpiPriorities: kpiPriorityList(reachKpis),
    objectiveEmphasis: "Awareness maximization — gross reach and impression velocity over engagement depth",
    postingCadence: `${burstPlan.postsPerWeek} posts/week, burst front-loaded (Week 1 peak)`,
    riskProfile: "high",
    audienceStrategy: "Broad demographic reach — mass awareness with lookalike expansion",
    risks: [
      "Lower engagement depth vs tier-heavy UGC plan",
      "Macro/Mega availability in compressed burst window",
      "Trust transfer weaker without Nano/Micro volume",
      "Higher CPM — premium tier concentration increases cost-per-impression",
    ],
  };

  const optionB: CampaignOption = {
    id: "B",
    label: "Balanced",
    archetype: "balanced",
    strategySlice: `${brand} — Balanced: Director default tier waterfall, even ${durationWeeks}-week cadence (${evenPlan.weekWeights.map((w, i) => `W${i + 1} ${w}%`).join(", ")}), moderate risk/efficiency for ${objective}.`,
    creatorTierStrategy: balancedTiers(baseTiers),
    timeline: {
      durationWeeks,
      rationale:
        strategy.understanding.timeline?.rationale ??
        `${durationWeeks}-week standard activation — even weekly creator rollout`,
      activationOrder: describeActivationOrder(evenPlan),
      activationPlan: evenPlan,
    },
    budget: {
      creatorFeePercent: 88,
      contingencyPercent: 12,
      rationale: "88% creator fees with 12% contingency — standard tier-mix allocation per Director strategy",
    },
    kpis: balancedKpis,
    kpiPriorities: kpiPriorityList(balancedKpis),
    objectiveEmphasis: "Balanced awareness + engagement — proven tier mix aligned to CampaignFacts SSOT",
    postingCadence: `${evenPlan.postsPerWeek} posts/week, even distribution across ${durationWeeks} weeks`,
    riskProfile: "moderate",
    audienceStrategy: "Core target audience with measured lookalike expansion",
    risks: strategy.understanding.risks.slice(0, 3),
  };

  const optionC: CampaignOption = {
    id: "C",
    label: "Maximum Engagement",
    archetype: "max_engagement",
    strategySlice: `${brand} — Maximum Engagement: heavy Micro/Nano UGC-first mix, ramp activation (${rampPlan.weekWeights.map((w, i) => `W${i + 1} ${w}%`).join(", ")}), ER-led KPIs, lowest CPE for ${objective}.`,
    creatorTierStrategy: maxEngagementTiers(baseTiers),
    timeline: {
      durationWeeks,
      rationale: `${durationWeeks}-week campaign — ramp activation builds Micro/Nano UGC volume toward mid-campaign peak`,
      activationOrder: describeActivationOrder(rampPlan),
      activationPlan: rampPlan,
    },
    budget: {
      creatorFeePercent: 85,
      contingencyPercent: 15,
      rationale: "85% creator fees — volume Nano/Micro roster is cost-efficient; higher contingency for UGC revision cycles",
    },
    kpis: engagementKpis,
    kpiPriorities: kpiPriorityList(engagementKpis),
    objectiveEmphasis: "Engagement & UGC volume — peer-trust content over top-line reach",
    postingCadence: `${rampPlan.postsPerWeek} posts/week, ramp acceleration toward mid-campaign UGC peak`,
    riskProfile: "low",
    audienceStrategy: "Community-first micro-segments — peer-trust Nano/Micro creator networks",
    risks: [
      "Lower top-line reach vs Macro-heavy plan",
      "UGC quality variance across Nano tier",
      "Ramp delay — peak engagement arrives mid-campaign, not Week 1",
      "Lowest CPE but requires client acceptance of engagement-over-impressions framing",
    ],
  };

  return [optionA, optionB, optionC];
}

export function getOptionById(options: CampaignOption[], id: OptionId): CampaignOption | undefined {
  return options.find((o) => o.id === id);
}
