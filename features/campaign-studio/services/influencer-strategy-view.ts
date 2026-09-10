import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  deriveEnterprisePlanningNarrative,
  type EnterprisePlanningNarrative,
} from "./planning-narrative";
import {
  deriveCreatorQuantityRecommendation,
  resolveCreatorTierMixWithBasis,
  formatCreatorTierMixSummary,
} from "./creator-quantity";
import { creatorTierStrategyToMix } from "@/features/campaign-director/facts/facts-display-bridge";
import { CREATOR_TIER_MIX_BASIS_LABEL } from "@/features/campaign-director/facts/creator-tier-preference";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";

export type InfluencerStrategyAnswer = {
  key: string;
  label: string;
  body: string;
};

function firstUseful(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "Insufficient evidence — confirm Campaign Intelligence.";
}

/**
 * One influencer-marketing Strategy checklist. Projects from Planning Narrative
 * wording + Campaign Facts — does not fork a second executive summary SSOT.
 */
export function deriveInfluencerStrategyView(
  campaignObject: CampaignObject,
  narrative?: EnterprisePlanningNarrative
): InfluencerStrategyAnswer[] {
  const story = narrative ?? deriveEnterprisePlanningNarrative(campaignObject);
  const facts = getCampaignFacts(campaignObject);
  // One tier-mix source of truth: an explicit Strategy allocation, else the
  // documented industry fallback. Both the summary line and the tier allocation
  // below read this same value, so they cannot contradict each other.
  const strategy = getStrategyFromWorkflowData(
    campaignObject.meta as unknown as Record<string, unknown>
  );
  const strategyTierMix = strategy?.creatorTierStrategy?.length
    ? creatorTierStrategyToMix(strategy.creatorTierStrategy)
    : undefined;
  const quantity = deriveCreatorQuantityRecommendation(facts, { tierMix: strategyTierMix });
  const mix = quantity.mix;
  const mixSummary = formatCreatorTierMixSummary(mix);
  // Say where the allocation came from. A split the brief did not state must
  // never read as though it did.
  const { basis: mixBasis } = resolveCreatorTierMixWithBasis(facts, strategyTierMix);
  // Canonical categories resolved by the intelligence pipeline.
  const categories = facts?.creatorCategories ?? [];

  const pillar = (key: string) => story.strategyPillars.find((item) => item.key === key)?.body;

  // The confidence is Thinkway's confidence in the QUANTITY recommendation —
  // it is computed from how many of duration, budget and objective are
  // confirmed, and says nothing about creator quality, creator fit, or the
  // chance of finding creators. Naming it stops that misreading.
  const quantityBody =
    quantity.recommended != null
      ? `${quantity.recommended} creators · ${Math.round(quantity.confidence * 100)}% confidence in this quantity recommendation. ${quantity.rationale}`
      : quantity.rationale;

  const tierBody =
    mix.length > 0
      ? [
          `${CREATOR_TIER_MIX_BASIS_LABEL[mixBasis]}.`,
          ...mix.map(
            (tier) =>
              `${tier.count} ${tier.tier} (${tier.percent}%)${tier.reasoning ? ` — ${tier.reasoning}` : ""}`
          ),
        ].join(" ")
      : firstUseful(pillar("creatorStrategy"));

  return [
    {
      key: "objective",
      label: "Campaign objective",
      body: firstUseful(pillar("campaignObjective"), facts?.objective, story.executiveBrief.objective),
    },
    {
      key: "audience",
      label: "Audience",
      body: firstUseful(pillar("audienceStrategy"), facts?.audience),
    },
    {
      key: "influencerStrategy",
      label: "Influencer strategy",
      // Derived from the same mix as "Creator tiers" — never a separate table.
      body: firstUseful(mixSummary, pillar("creatorStrategy"), story.creatorPackageThesis),
    },
    {
      key: "creatorCategories",
      label: "Creator categories",
      body:
        categories.length > 0
          ? `Prioritise creators in ${categories.join(" · ")} who can speak to the product and market with proof, not generic lifestyle filler.`
          : firstUseful(pillar("creatorStrategy")),
    },
    {
      key: "creatorTiers",
      label: "Creator tiers",
      body: tierBody,
    },
    {
      key: "platformStrategy",
      label: "Platform strategy",
      body: firstUseful(
        pillar("mediaStrategy"),
        facts?.platforms?.length ? `Lead on ${facts.platforms.join(" + ")}.` : undefined
      ),
    },
    {
      key: "contentStrategy",
      label: "Content strategy",
      body: firstUseful(pillar("contentStrategy")),
    },
    {
      key: "quantity",
      label: "Creator quantity + rationale",
      body: quantityBody,
    },
    {
      key: "commercial",
      label: "Commercial approach",
      body: firstUseful(pillar("commercialStrategy"), story.budgetNarrative.commercialImpact),
    },
    {
      key: "risks",
      label: "Key risks",
      body: firstUseful(pillar("businessRisks"), story.executiveBrief.risks),
    },
    {
      key: "decisions",
      label: "Decisions required",
      body: firstUseful(
        story.spine.find((item) => item.key === "openDecisions")?.body,
        story.executiveDecisionSummary.openDecisions
      ),
    },
  ];
}
