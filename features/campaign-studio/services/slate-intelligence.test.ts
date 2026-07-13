import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";
import type { SearchCreatorCardItem } from "./creator-platform-utils";
import {
  detectTierShortages,
  rankSlateRecommendations,
} from "./slate-intelligence";

function card(id: string, followers: number): SearchCreatorCardItem {
  return {
    id,
    handle: id,
    displayName: id,
    platform: "instagram",
    followers,
    engagementRate: 3,
  };
}

function minimalCampaignObject(): CampaignObject {
  return {
    id: "co-1",
    updatedAt: new Date().toISOString(),
    sections: {
      summary: { content: "", status: "complete" },
      audience: { content: "", status: "complete" },
      strategy: {
        content: "",
        status: "complete",
        data: {
          creatorMix: [
            { tier: "Macro", count: 2, percent: 40, reasoning: "Anchor" },
            { tier: "Micro", count: 3, percent: 60, reasoning: "Volume" },
          ],
        },
      },
      creators: { content: "", status: "complete", data: {} },
      budget: { content: "", status: "complete" },
      timeline: {
        content: "",
        status: "complete",
        data: {
          creatorActivationTimeline: {
            durationWeeks: 4,
            activationWeeks: [
              { week: 1, tier: "Macro", objective: "Launch", reason: "", evidence: "", tradeoff: "", confidence: 80 },
              { week: 2, tier: "Micro", objective: "UGC", reason: "", evidence: "", tradeoff: "", confidence: 80 },
            ],
            reportingPhase: { label: "Reporting", reason: "" },
          },
        },
      },
      performance: { content: "", status: "complete" },
      presentation: { content: "", status: "complete" },
      operations: { content: "", status: "complete" },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        extractedAt: new Date().toISOString(),
        confidence: {},
        sources: {},
        brandName: "Test Brand",
        budget: { amount: 100000, currency: "EGP" },
      },
    },
  };
}

test("detectTierShortages flags under-supplied tiers", () => {
  const object = minimalCampaignObject();
  const cards = [
    card("a", 600_000),
    card("b", 15_000),
  ];
  const warnings = detectTierShortages(
    object.sections.strategy.data!.creatorMix as CreatorMixTier[],
    cards
  );
  assert.ok(warnings.some((w) => w.tier === "Micro" && w.required === 3 && w.actual === 1));
});

test("rankSlateRecommendations tags overflow creators as maybe", () => {
  const object = minimalCampaignObject();
  const cards = [
    card("macro-1", 600_000),
    card("macro-2", 550_000),
    card("macro-3", 520_000),
    card("micro-1", 20_000),
  ];
  const recs = rankSlateRecommendations(object, cards);
  const mains = recs.filter((r) => r.role === "main");
  const maybes = recs.filter((r) => r.role === "maybe");
  assert.ok(mains.length >= 2);
  assert.ok(maybes.length >= 1);
  assert.ok(recs.some((r) => r.suggestedTimelineSlot?.includes("Week")));
});
