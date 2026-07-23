import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  buildInfluencerConcepts,
  generateInfluencerConcepts,
  INFLUENCER_CONCEPTS_EXPAND_MESSAGE,
  INFLUENCER_CONCEPTS_PREVIEW_COUNT,
  assertConceptReferencesCampaign,
  isProductionNotesBoilerplate,
  parseInfluencerConceptsFromBrief,
  renderInfluencerConceptsSummaryHtml,
  resolveArabicDialect,
  shouldShowProductionNotes,
} from "@/features/campaign-outputs/influencer-concepts";
import {
  buildAllConceptsJsonExport,
  buildConceptJsonExport,
} from "@/features/campaign-outputs/influencer-concepts-export";
import { buildMediaPlanHtml, buildMediaPlanPreviewHtmlDocument } from "@/features/campaign-outputs/export/media-plan-html";
import { defaultMediaPlanPresentation } from "@/features/campaign-outputs/media-plan-presentation";
import { buildMediaPlanExportHrefWithOptions } from "@/features/campaign-outputs/components/media-plan-export-dialog";
import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import type { StrategySectionData } from "@/features/campaign-intelligence/types/section-schemas";

test("brief extraction takes priority over AI influencer concepts", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt: `
Influencer Concept 1: Summer Glow
Creative Objective: Hero product through morning GRWM routine.
Target Creator Types: Beauty, Lifestyle
Recommended Platforms: Instagram, TikTok
Story Flow: Hook → demo → CTA
Key Talking Points:
- Natural lighting
CTA: Shop now
`,
      durationWeeks: 4,
    },
  });

  const result = buildInfluencerConcepts({
    campaignObject: object,
    platformAllocation: { Instagram: 4, TikTok: 2 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
  });

  assert.equal(result.source, "brief");
  assert.ok(result.concepts.length >= 1);
  assert.equal(result.concepts[0]!.source, "brief");
  assert.match(result.concepts[0]!.english.conceptTitle, /Summer Glow/i);
});

test("AI generation runs when no brief or stored concepts exist", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt: "Generic awareness campaign with no structured concepts.",
      brandName: "Acme",
      objective: "Drive awareness",
      geography: ["Egypt"],
      durationWeeks: 4,
    },
  });

  const result = buildInfluencerConcepts({
    campaignObject: object,
    briefText: "Generic awareness campaign with no structured concepts.",
    platformAllocation: { Instagram: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
  });

  assert.equal(result.source, "ai");
  assert.ok(result.concepts.length >= 3);
  assert.ok(result.concepts.every((concept) => concept.source === "ai"));
});

test("AI concepts reference brand product or objective", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch in Egypt",
    objective: "Drive awareness for Glow serum",
    brand: "Glow",
    product: "Glow Serum",
    platforms: ["Instagram"],
    creatorCategories: ["beauty", "lifestyle"],
    marketCountry: "Egypt",
    dialect: resolveArabicDialect("Egypt"),
    slate: [],
  });

  for (const concept of concepts) {
    assertConceptReferencesCampaign(concept.english, "Glow", "Glow Serum", "Drive awareness for Glow serum");
    assert.ok(!/everyday hero moment|social proof spark/i.test(concept.english.conceptTitle));
  }
});

test("AI concepts exclude competition when brief does not signal", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare awareness campaign — no UGC or challenges.",
    objective: "Drive awareness",
    brand: "Glow",
    product: "Glow Serum",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    dialect: "gulf",
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
  });

  for (const concept of concepts) {
    assert.ok(!/\bcompetition\b|\bwinner\b|\bchallenge\b/i.test(concept.english.creativeObjective));
  }
});

test("Arabic concepts are localized not empty copies", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch in Egypt",
    objective: "Awareness",
    brand: "Glow",
    product: "Glow Serum",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    marketCountry: "Egypt",
    dialect: resolveArabicDialect("Egypt"),
    slate: [],
  });

  const first = concepts[0]!;
  assert.notEqual(first.arabic.creativeObjective, first.english.creativeObjective);
  assert.ok(first.arabic.cta.length > 0);
  assert.equal(first.arabic.productionNotes, "");
  assert.ok(!shouldShowProductionNotes(first.arabic.productionNotes));
});

test("Arabic tab content has no English sentence fragments", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Dolphin Tuna launch in Delta Region Egypt",
    objective: "Drive awareness",
    brand: "Dolphin Tuna",
    product: "Dolphin Tuna",
    platforms: ["Instagram", "TikTok", "Facebook"],
    creatorCategories: ["lifestyle", "food"],
    marketCountry: "Egypt",
    dialect: resolveArabicDialect("Egypt"),
    slate: [],
  });

  const ar = concepts[0]!.arabic;
  const combined = [
    ar.creativeObjective,
    ar.storyFlow,
    ar.expectedAudienceReaction,
    ...ar.keyTalkingPoints,
    ...Object.values(ar.creatorAdaptations),
  ].join("\n");

  assert.ok(!/\bbenefit for\b/i.test(combined));
  assert.ok(!/\bMarket:\b/i.test(combined));
  assert.ok(!/— بلهجة .+ طبيعية/.test(combined));
  assert.ok(!/\bplatform-native\b/i.test(combined));
  for (const point of ar.keyTalkingPoints) {
    assert.ok(!/benefit for/i.test(point));
  }
});

test("production notes boilerplate is detected and hidden", () => {
  assert.ok(
    isProductionNotesBoilerplate(
      "إنتاج بأسلوب المنصة — لهجة مصري محلية، بدون ترجمة حرفية"
    )
  );
  assert.ok(
    isProductionNotesBoilerplate(
      "Platform style — local dialect, no literal translation"
    )
  );
  assert.ok(!isProductionNotesBoilerplate("File reference: brief.pdf"));
  assert.ok(shouldShowProductionNotes("File reference: brief.pdf"));
  assert.ok(!shouldShowProductionNotes("إنتاج بأسلوب المنصة — لهجة مصري محلية، بدون ترجمة حرفية"));
});

test("concept JSON export produces valid JSON", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch",
    brand: "Glow",
    product: "Glow Serum",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    dialect: "gulf",
    slate: [],
  });

  const single = JSON.parse(buildConceptJsonExport(concepts[0]!));
  assert.equal(single.id, concepts[0]!.id);
  assert.ok(single.english.conceptTitle);

  const all = JSON.parse(buildAllConceptsJsonExport(concepts));
  assert.ok(Array.isArray(all));
  assert.equal(all.length, concepts.length);
});

test("bilingual structure is present on generated concepts", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch in Egypt",
    objective: "Awareness",
    brand: "Glow",
    platforms: ["Instagram"],
    creatorCategories: ["beauty", "lifestyle"],
    marketCountry: "Egypt",
    dialect: resolveArabicDialect("Egypt"),
    slate: [],
  });

  assert.ok(concepts.length);
  const first = concepts[0]!;
  assert.ok(first.english.conceptTitle);
  assert.ok(first.arabic.conceptTitle);
  assert.ok(first.arabic.creativeObjective);
  assert.ok(first.arabic.cta);
});

test("creator-type adaptations are generated", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Food and comedy creators for a snack brand",
    brand: "Crunch",
    platforms: ["TikTok"],
    creatorCategories: ["food", "comedy"],
    dialect: "egyptian",
    slate: [],
  });

  const adaptations = concepts[0]!.english.creatorAdaptations;
  assert.ok(adaptations.food);
  assert.ok(adaptations.comedy);
});

test("stored approved concepts override AI when brief is empty", () => {
  const object = buildCampaignObjectFixture({
    facts: { rawBriefExcerpt: "No concepts in brief.", durationWeeks: 4 },
  });
  object.meta.influencerConcepts = {
    concepts: [
      {
        id: "stored-1",
        source: "manual",
        approved: true,
        english: {
          conceptTitle: "Stored Hero",
          creativeObjective: "From meta storage",
          targetCreatorTypes: ["Lifestyle"],
          recommendedPlatforms: ["Instagram"],
          suggestedDeliverables: ["Reel"],
          expectedAudienceReaction: "Engagement",
          storyFlow: "Hook → CTA",
          keyTalkingPoints: ["Point A"],
          cta: "Buy",
          hashtags: ["#Stored"],
          suggestedShotList: ["Opener"],
          productionNotes: "Notes",
          estimatedDuration: "30s",
          creatorAdaptations: { lifestyle: "Daily routine" },
        },
        arabic: {
          conceptTitle: "Stored Hero AR",
          creativeObjective: "From meta storage",
          targetCreatorTypes: ["Lifestyle"],
          recommendedPlatforms: ["Instagram"],
          suggestedDeliverables: ["Reel"],
          expectedAudienceReaction: "Engagement",
          storyFlow: "Hook → CTA",
          keyTalkingPoints: ["Point A"],
          cta: "Buy",
          hashtags: ["#Stored"],
          suggestedShotList: ["Opener"],
          productionNotes: "Notes",
          estimatedDuration: "30s",
          creatorAdaptations: { lifestyle: "Daily routine" },
        },
      },
    ],
  };

  const result = buildInfluencerConcepts({
    campaignObject: object,
    platformAllocation: { Instagram: 4 },
    slate: [],
  });

  assert.equal(result.source, "stored");
  assert.equal(result.concepts[0]!.english.conceptTitle, "Stored Hero");
});

test("parseInfluencerConceptsFromBrief maps strategy creative concepts", () => {
  const brief = `
Concept 1: Sunrise Ritual
Creative Idea: Morning routine integration with hero product.
Story Flow: Hook → demo → CTA
Talking Points:
- Natural lighting
CTA: Shop now
`;

  const concepts = parseInfluencerConceptsFromBrief(brief, {
    platforms: ["Instagram"],
    deliverables: ["Reel"],
  });

  assert.equal(concepts.length, 1);
  assert.equal(concepts[0]!.source, "brief");
  assert.match(concepts[0]!.english.creativeObjective, /Morning routine/i);
});

test("Creative Direction HTML shows concepts without clipping styles", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt: "Four-week awareness campaign for skincare in Egypt.",
      durationWeeks: 4,
    },
  });
  object.sections.strategy.data = {
    creativeConcepts: [
      {
        name: "Concept A",
        bigIdea: "Big idea A with enough detail to render in export.",
        hook: "Hook A",
        keyVisual: "Visual A",
        contentTheme: "Theme A",
        cta: "CTA A",
        sampleCaption: "Caption A",
        hashtags: ["#A"],
      },
      {
        name: "Concept B",
        bigIdea: "Big idea B with enough detail to render in export.",
        hook: "Hook B",
        keyVisual: "Visual B",
        contentTheme: "Theme B",
        cta: "CTB B",
        sampleCaption: "Caption B",
        hashtags: ["#B"],
      },
      {
        name: "Concept C",
        bigIdea: "Big idea C with enough detail to render in export.",
        hook: "Hook C",
        keyVisual: "Visual C",
        contentTheme: "Theme C",
        cta: "CTC C",
        sampleCaption: "Caption C",
        hashtags: ["#C"],
      },
    ],
  } satisfies StrategySectionData;

  const content = generateMediaPlan(object);
  const html = buildMediaPlanHtml(content);

  assert.ok(!html.includes("max-height:420px"), "concept cards should not clip with max-height");
  assert.ok(html.includes("creative-direction-page"));
  assert.ok(html.includes("Influencer Concepts"));
  assert.ok(html.includes("ic-collapsed-card"));
  assert.ok(html.includes("Summary only"));
  assert.ok(!html.includes("Expand in preview"));
});

test("renderInfluencerConceptsSummaryHtml interactive variant is clickable and posts expand message", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch",
    brand: "Glow",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    dialect: "gulf",
    slate: [],
  });

  const html = renderInfluencerConceptsSummaryHtml(concepts, { variant: "interactive" });

  assert.ok(html.includes('data-ic-expand="1"'));
  assert.ok(html.includes("Click to expand"));
  assert.ok(!html.includes("Expand in preview"));
  assert.ok(!html.includes("open Thinkway preview"));
});

test("buildMediaPlanPreviewHtmlDocument wires influencer concept expand postMessage", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanPreviewHtmlDocument(content);

  assert.ok(html.includes('data-ic-expand="1"'));
  assert.ok(html.includes(INFLUENCER_CONCEPTS_EXPAND_MESSAGE));
  assert.ok(html.includes("postMessage"));
});

test("renderInfluencerConceptsSummaryHtml shows 4 concept rows with status badges", () => {
  const concepts = generateInfluencerConcepts({
    briefText: "Skincare launch",
    brand: "Glow",
    product: "Glow Serum",
    objective: "Awareness",
    platforms: ["Instagram"],
    creatorCategories: ["beauty"],
    dialect: "gulf",
    slate: [],
  });

  const html = renderInfluencerConceptsSummaryHtml(concepts, { maxPreview: INFLUENCER_CONCEPTS_PREVIEW_COUNT });

  assert.ok(html.includes("ic-summary-row"));
  assert.ok(html.includes("ic-status-badge"));
  assert.ok(html.includes("ic-summary-meta"));
  assert.ok(html.includes("Hook:"));
});

test("buildMediaPlanExportHrefWithOptions includes export mode params", () => {
  const href = buildMediaPlanExportHrefWithOptions("obj-1", "pdf", {
    exportMode: "strategy",
    conceptsExport: "full",
    view: "client",
  });
  assert.ok(href.includes("exportMode=strategy"));
  assert.ok(href.includes("conceptsExport=full"));
  assert.ok(href.includes("view=client"));
  assert.ok(!href.includes("includeCost=0"));
});

test("buildMediaPlanExportHrefWithOptions omits cost for calendar deliverables", () => {
  const href = buildMediaPlanExportHrefWithOptions("obj-1", "pdf", {
    exportMode: "standard",
    includeCampaignCost: false,
  });
  assert.ok(href.includes("exportMode=standard"));
  assert.ok(href.includes("includeCost=0"));
});

test("buildMediaPlanHtml respects standard presentation — hides platform intelligence", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("standard"),
  });

  assert.ok(!html.includes("Platform Intelligence") || html.includes("Campaign Strategy"));
});

test("buildMediaPlanHtml export uses static summary-only influencer concepts copy", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content);

  if (html.includes("ic-collapsed-card")) {
    assert.ok(html.includes("Summary only"));
    assert.ok(!html.includes('data-ic-expand="1"'));
    assert.ok(!html.includes("Expand in preview"));
  }
});

test("resolveArabicDialect maps Egypt to egyptian", () => {
  assert.equal(resolveArabicDialect("Egypt"), "egyptian");
  assert.equal(resolveArabicDialect("Saudi Arabia"), "saudi");
  assert.equal(resolveArabicDialect("UAE"), "gulf");
});
