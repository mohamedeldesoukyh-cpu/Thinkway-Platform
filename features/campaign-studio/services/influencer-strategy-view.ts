import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  deriveEnterprisePlanningNarrative,
  type EnterprisePlanningNarrative,
} from "./planning-narrative";
import { deriveCreatorCategoriesFromBrief } from "./derive-creator-categories";
import { deriveCreatorQuantityRecommendation } from "./creator-quantity";

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
  const quantity = deriveCreatorQuantityRecommendation(facts);
  const mix = quantity.mix;
  const categories = deriveCreatorCategoriesFromBrief({
    briefText: facts?.rawBriefExcerpt,
    objective: facts?.objective,
    audience: facts?.audience,
    campaignName: facts?.product,
    products: facts?.product ? [facts.product] : undefined,
  });

  const pillar = (key: string) => story.strategyPillars.find((item) => item.key === key)?.body;

  const quantityBody =
    quantity.recommended != null
      ? `${quantity.recommended} creators (${Math.round(quantity.confidence * 100)}% confidence). ${quantity.rationale}`
      : quantity.rationale;

  const tierBody =
    mix.length > 0
      ? mix
          .map(
            (tier) =>
              `${tier.count} ${tier.tier} (${tier.percent}%)${tier.reasoning ? ` — ${tier.reasoning}` : ""}`
          )
          .join(" ")
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
      body: firstUseful(pillar("creatorStrategy"), story.creatorPackageThesis),
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
