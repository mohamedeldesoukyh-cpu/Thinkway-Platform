import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildMarketTimingCitations,
  buildMarketSchedulingContext,
  DEFAULT_MARKET_INTELLIGENCE_CONFIG,
} from "@/features/market-intelligence";
import { buildSectionRationale } from "@/features/campaign-outputs/media-plan-section-rationale";
import { campaignTypeWeeklyPhase } from "@/features/campaign-outputs/campaign-type-classifier";
import {
  generateInfluencerConcepts,
  renderInfluencerConceptsSummaryHtml,
  resolveArabicDialect,
} from "@/features/campaign-outputs/influencer-concepts";
import { buildMediaPlanExportHrefWithOptions } from "@/features/campaign-outputs/components/media-plan-export-dialog";
import { buildMediaPlanStrategyNarrative } from "@/features/campaign-outputs/media-plan-strategy-narrative";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

test("renderInfluencerConceptsSummaryHtml uses language tabs — no mixed EN/AR in default view", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch in Egypt",
    brand: "Glow",
    product: "Glow Serum",
    objective: "Awareness",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    dialect: resolveArabicDialect("Egypt"),
    slate: [],
  });

  const enOnly = renderInfluencerConceptsSummaryHtml(concepts, { language: "en" });
  assert.ok(!enOnly.includes("ic-preview-ar"));
  assert.ok(enOnly.includes('data-active-lang="en"'));
  assert.ok(!enOnly.match(/ic-locale-ar[^"]*"[^>]*>[\s\S]*English[\s\S]*العربية/));

  const bilingual = renderInfluencerConceptsSummaryHtml(concepts, { language: "bilingual" });
  assert.ok(bilingual.includes("ic-lang-tabs"));
  assert.ok(bilingual.includes("English"));
  assert.ok(bilingual.includes("العربية"));
  assert.ok(!bilingual.includes("ic-preview-ar"));
});

test("buildMarketTimingCitations returns structured driver citations", () => {
  const context = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 10, 1, 12, 0, 0, 0),
    durationWeeks: 4,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      countries: ["UAE"],
      category: "beauty",
    },
  });

  const citations = buildMarketTimingCitations({
    context,
    weekWeights: [35, 35, 20, 10],
    durationWeeks: 4,
    objective: "Drive conversion during White Friday",
  });

  assert.ok(citations.length >= 1);
  const first = citations[0]!;
  assert.ok(first.driver);
  assert.ok(first.evidence);
  assert.ok(first.reason);
  assert.ok(first.impact);
  assert.ok(first.confidencePercent >= 50 && first.confidencePercent <= 100);
});

test("buildSectionRationale returns bullets for platform allocation", () => {
  const bullets = buildSectionRationale("platformAllocation", {
    briefText: "Instagram and TikTok campaign for beauty awareness in UAE",
    objective: "Drive awareness",
    weekWeights: [40, 30, 20, 10],
    platformAllocation: { Instagram: 6, TikTok: 4 },
    slate: [],
  });

  assert.ok(bullets.length >= 1);
  assert.ok(bullets.some((bullet) => /Instagram|platform/i.test(bullet)));
});

test("creator mix narrative includes tier strategic rationale", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [40, 30, 20, 10],
    durationWeeks: 4,
    platformAllocation: { Instagram: 4 },
    slate: [
      { creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] },
      { creatorId: "2", displayName: "B", tier: "Mid", serviceTypes: ["Reel"] },
      { creatorId: "3", displayName: "C", tier: "Micro", serviceTypes: ["Story"] },
    ],
    briefText: "Beauty campaign with macro mid micro mix",
    objective: "Awareness",
  });

  assert.match(narrative.creatorMixIntelligence, /Macro.*bridge|Macro/i);
  assert.match(narrative.creatorMixIntelligence, /Mid-tier|Mid/i);
  assert.match(narrative.creatorMixIntelligence, /Micro/i);
});

test("weekly objectives use campaign-type phases not only generic Launch", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [40, 30, 20, 10],
    durationWeeks: 4,
    platformAllocation: { Instagram: 4 },
    slate: [],
    briefText: "New product launch for skincare brand Glow",
    objective: "Product launch awareness",
    industry: "beauty",
  });

  const phases = narrative.weeklyObjectives.map((week) => week.phase);
  assert.ok(phases.some((phase) => /Reveal|Trial|Proof|Convert|Introduce/i.test(phase)));
  assert.ok(narrative.sectionRationale?.weeklyObjectives?.length);
});

test("campaignTypeWeeklyPhase maps product launch to Reveal then Convert", () => {
  assert.equal(campaignTypeWeeklyPhase("product_launch", "Launch", 0, 4), "Reveal");
  assert.equal(campaignTypeWeeklyPhase("product_launch", "Wrap-up", 3, 4), "Convert");
});

test("buildMediaPlanExportHrefWithOptions passes wizard params", () => {
  const href = buildMediaPlanExportHrefWithOptions("obj-1", "pdf", {
    exportMode: "strategy",
    conceptsExport: "full",
    view: "internal",
    exportLanguage: "bilingual",
    includeProductionSchedule: false,
    includeInternalNotes: true,
  });
  assert.ok(href.includes("exportMode=strategy"));
  assert.ok(href.includes("conceptsExport=full"));
  assert.ok(href.includes("view=internal"));
  assert.ok(href.includes("exportLanguage=bilingual"));
  assert.ok(href.includes("productionSchedule=0"));
  assert.ok(href.includes("internalNotes=1"));
});

test("strategy narrative includes market timing citations for UAE", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.campaignFacts = {
    ...obj.meta.campaignFacts,
    geography: ["UAE"],
    campaignStartDate: "2026-11-01",
    objective: "Drive conversion during White Friday",
  };

  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [35, 35, 20, 10],
    durationWeeks: 4,
    platformAllocation: { Instagram: 4, TikTok: 4 },
    slate: [],
    briefText: "Beauty launch UAE White Friday salary week",
    objective: "Drive conversion during White Friday",
    campaignObject: obj,
    campaignStartDate: "2026-11-01",
  });

  assert.ok(narrative.marketTimingCitations?.length);
  assert.ok(narrative.sectionRationale?.marketTiming?.length);
});
