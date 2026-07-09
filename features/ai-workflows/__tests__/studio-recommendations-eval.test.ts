import assert from "node:assert/strict";
import test from "node:test";

import { rankBrowseCreatorsForCampaign } from "@/lib/discovery/rank-browse-for-campaign";
import { rerankCreatorsByCampaignFit } from "@/lib/discovery/campaign-fit-rerank";
import { buildEvidenceBasedSelection } from "@/features/campaign-intelligence/services/reasoning/evidence-vendor-reasoning";
import { buildIs1CampaignContext } from "@/features/campaign-intelligence/services/reasoning/campaign-context";
import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import {
  mappedFiltersForFixture,
  STUDIO_RECOMMENDATION_FIXTURES,
} from "./fixtures/studio-recommendation-briefs";

async function runPipeline(fixture: (typeof STUDIO_RECOMMENDATION_FIXTURES)[number]) {
  const mapped = mappedFiltersForFixture(fixture);
  const phase1 = rankBrowseCreatorsForCampaign(fixture.creators, fixture.profile, mapped);
  const { creators: phase2 } = await rerankCreatorsByCampaignFit(phase1, fixture.profile);
  return phase2;
}

for (const fixture of STUDIO_RECOMMENDATION_FIXTURES) {
  test(`studio recommendations eval — ${fixture.label}`, async () => {
    const ranked = await runPipeline(fixture);
    assert.ok(ranked.length > 0, "pipeline must return creators");

    const top = ranked[0]!;
    const topPlatform = top.platforms[0]?.platform?.toLowerCase();

    if (fixture.expectTopPlatform) {
      assert.equal(
        topPlatform,
        fixture.expectTopPlatform,
        `expected top platform ${fixture.expectTopPlatform}, got ${topPlatform}`
      );
    }

    if (fixture.expectTopCountry) {
      const country = top.country_code ?? top.platforms[0]?.audience_country;
      assert.equal(country, fixture.expectTopCountry);
    }

    if (fixture.expectTopCategory) {
      const categories = [...top.categories, ...(top.browse_category_tags ?? [])].map((c) =>
        c.toLowerCase()
      );
      assert.ok(
        categories.some((c) => c.includes(fixture.expectTopCategory!.toLowerCase())),
        `expected category ${fixture.expectTopCategory} in top creator`
      );
    }

    if (fixture.minTopRelevanceScore != null) {
      assert.ok(
        (top.campaign_relevance_score ?? 0) >= fixture.minTopRelevanceScore,
        `top relevance ${top.campaign_relevance_score} below ${fixture.minTopRelevanceScore}`
      );
    }
  });
}

test("evidence-based reasoning links requirements to creator fields", () => {
  const ctx = buildIs1CampaignContext(
    {
      brandName: "Etisalat",
      objective: "5G awareness",
      audience: "Gen Z UAE",
      geography: ["AE"],
      platforms: ["tiktok"],
    } as CampaignFacts,
    {
      understanding: {
        brand: "Etisalat",
        objective: "5G awareness",
        audience: "Gen Z UAE",
        geography: "AE",
        platforms: ["tiktok"],
      },
    } as CampaignStrategyDocument
  );

  const creator: GroundedCreator = {
    id: "inf:1",
    handle: "uae_5g",
    displayName: "UAE Tech",
    platform: "tiktok",
    followers: 200_000,
    engagementRate: 5.2,
    campaignRelevanceScore: 85,
  };

  const selection = buildEvidenceBasedSelection(creator, ctx, "Macro", 0);
  assert.ok(selection.whySelected.includes("→"), "whySelected must use requirement → evidence format");
  assert.ok(selection.evidence.includes("→"));
  assert.ok(selection.confidence >= 70);
});
