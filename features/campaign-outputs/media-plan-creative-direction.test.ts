import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  buildMediaPlanCreativeDirection,
  parseCreativeConceptsFromBrief,
  resolveApprovedCreativeConcepts,
} from "@/features/campaign-outputs/media-plan-creative-direction";
import { buildMediaPlanStrategySummary } from "@/features/campaign-outputs/media-plan-strategy-summary";
import type { StrategySectionData } from "@/features/campaign-intelligence/types/section-schemas";

test("approved brief concepts take priority over Thinkway recommendations", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt: "Summer launch for Acme brand awareness campaign.",
      durationWeeks: 4,
    },
  });
  object.sections.strategy.data = {
    creativeConcepts: [
      {
        name: "Sunrise Ritual",
        bigIdea: "Morning routine integration with the hero product.",
        hook: "Wake up to summer freshness",
        keyVisual: "Golden hour bathroom scene",
        contentTheme: "GRWM summer edition",
        cta: "Shop the summer range",
        sampleCaption: "My morning just got brighter ☀️",
        hashtags: ["#SummerRitual"],
      },
    ],
  } satisfies StrategySectionData;

  const direction = buildMediaPlanCreativeDirection({
    campaignObject: object,
    briefText: "Summer launch for Acme brand awareness campaign.",
    platformAllocation: { Instagram: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
  });

  assert.equal(direction.concepts.length, 1);
  assert.equal(direction.concepts[0]!.source, "brief");
  assert.equal(direction.concepts[0]!.english.conceptName, "Sunrise Ritual");
  assert.equal(direction.thinkwayRecommendations, undefined);

  const summary = buildMediaPlanStrategySummary(object, { platformAllocation: { Instagram: 4 } });
  assert.ok(summary.creativeConcepts?.every((concept) => concept.source === "brief"));
  assert.ok(!summary.creativeConcepts?.some((concept) => /Thinkway Creative Recommendation/i.test(concept.name)));
});

test("Thinkway recommendations are labelled when no brief concepts exist", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt:
        "Four-week awareness campaign for a new skincare line targeting women 25–34 in Egypt.",
      durationWeeks: 4,
    },
  });

  const direction = buildMediaPlanCreativeDirection({
    campaignObject: object,
    briefText:
      "Four-week awareness campaign for a new skincare line targeting women 25–34 in Egypt.",
    platformAllocation: { Instagram: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel", "Story"] }],
  });

  assert.ok(direction.concepts.length > 0);
  assert.ok(direction.concepts.every((concept) => concept.source === "thinkway"));
  assert.ok(direction.thinkwayRecommendations?.length);
});

test("parseCreativeConceptsFromBrief extracts structured bilingual concepts", () => {
  const brief = `
Concept 1: Summer Glow
Creative Idea: Hero product revealed through a morning GRWM routine.
Story Flow: Hook → product demo → CTA
Talking Points:
- Natural lighting
- Summer freshness
CTA: Shop now

الفكرة الإبداعية: كشف المنتج الرئيسي من خلال روتين صباحي طبيعي.
نقاط الحديث:
- إضاءة طبيعية
دعوة للعمل: تسوق الآن
`;

  const concepts = parseCreativeConceptsFromBrief(brief);
  assert.equal(concepts.length, 1);
  assert.equal(concepts[0]!.source, "brief");
  assert.match(concepts[0]!.english.creativeIdea, /GRWM/i);
  assert.ok(concepts[0]!.arabic?.creativeIdea);
});

test("resolveApprovedCreativeConcepts prefers stored strategy concepts over brief parse", () => {
  const object = buildCampaignObjectFixture({
    facts: { rawBriefExcerpt: "Concept 1: Parsed\nCreative Idea: From raw brief only." },
  });
  object.sections.strategy.data = {
    creativeConcepts: [
      {
        name: "Stored Concept",
        bigIdea: "From strategy data",
        hook: "Hook",
        keyVisual: "Visual",
        contentTheme: "Theme",
        cta: "CTA",
        sampleCaption: "Caption",
        hashtags: [],
      },
    ],
  } satisfies StrategySectionData;

  const concepts = resolveApprovedCreativeConcepts(object);
  assert.equal(concepts[0]!.english.conceptName, "Stored Concept");
});
