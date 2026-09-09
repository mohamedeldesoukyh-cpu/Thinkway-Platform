/**
 * Creator planning — requested quantity, Strategy mix, and tier shortage.
 *
 * The chain under test:
 *   brief / operator → facts.requestedCreatorCount
 *     → deriveCreatorQuantityRecommendation (requested wins outright)
 *     → composeCreatorSlate (Strategy mix allocates; never substitutes tiers)
 *
 * The invariant throughout: a quantity is honoured when asked for and never
 * invented when not, and the slate is filled from the tiers the Strategy named
 * or comes up short and says so.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { creatorTierStrategyToMix } from "@/features/campaign-director/facts/facts-display-bridge";
import { formatShortlistSuggestion } from "@/features/ai-workflows/formatters/creator-formatter";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import { composeCreatorSlate } from "./creator-slate";
import { deriveCreatorQuantityRecommendation } from "./creator-quantity";
import type { SearchCreatorCardItem } from "./creator-platform-utils";
import {
  campaignFactsFromIntakeEdit,
  requiredIntakeFacts,
} from "./studio-intake-facts";

/** Follower bands: Nano <10K · Micro <100K · Mid <500K · Macro <1M · Mega <5M · Celebrity ≥5M */
const FOLLOWERS: Record<string, number> = {
  nano: 5_000,
  micro: 50_000,
  mid: 250_000,
  macro: 750_000,
  mega: 2_000_000,
  celebrity: 8_000_000,
};

function card(tier: keyof typeof FOLLOWERS, index: number): SearchCreatorCardItem {
  return {
    id: `${tier}-${index}`,
    handle: `${tier}_${index}`,
    displayName: `${tier} ${index}`,
    platform: "instagram",
    followers: FOLLOWERS[tier],
    engagementRate: 3,
    categories: ["Food"],
    campaignRelevanceScore: 80,
  } as unknown as SearchCreatorCardItem;
}

function pool(spec: Partial<Record<keyof typeof FOLLOWERS, number>>): SearchCreatorCardItem[] {
  return Object.entries(spec).flatMap(([tier, count]) =>
    Array.from({ length: count ?? 0 }, (_, i) => card(tier as keyof typeof FOLLOWERS, i))
  );
}

const STRATEGY_TIERS = [
  { tier: "Macro", allocationPercent: 40, why: "Reach" },
  { tier: "Micro", allocationPercent: 35, why: "Engagement" },
  { tier: "Nano", allocationPercent: 25, why: "Long tail" },
];
const STRATEGY_MIX = creatorTierStrategyToMix(STRATEGY_TIERS);

function facts(overrides?: Partial<CampaignFacts>): CampaignFacts {
  return {
    brandName: "Tafareeh Tea",
    objective: "Build awareness and encourage trial",
    durationWeeks: 2,
    platforms: ["instagram"],
    geography: ["Egypt"],
    extractedAt: "",
    confidence: {},
    sources: {},
    ...overrides,
  } as unknown as CampaignFacts;
}

function tierCounts(slate: SearchCreatorCardItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of slate) {
    const tier = c.id.split("-")[0]!;
    out[tier] = (out[tier] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Requested quantity

test("requested 10 → quantity 10 and a slate of 10", () => {
  const quantity = deriveCreatorQuantityRecommendation(
    facts({ requestedCreatorCount: 10 }),
    { tierMix: STRATEGY_MIX }
  );
  assert.equal(quantity.recommended, 10);
  assert.equal(quantity.confidence, 1);

  const { creators } = composeCreatorSlate(pool({ macro: 8, micro: 8, nano: 8 }), {
    tierMix: quantity.mix,
    targetCount: quantity.recommended!,
    preferredCategories: ["food"],
  });
  assert.equal(creators.length, 10);
});

test("10 → 12 → 9 recalculates both quantity and mix counts", () => {
  const sizes = [10, 12, 9];
  const seen = sizes.map((requested) => {
    const quantity = deriveCreatorQuantityRecommendation(
      facts({ requestedCreatorCount: requested }),
      { tierMix: STRATEGY_MIX }
    );
    const { creators } = composeCreatorSlate(pool({ macro: 8, micro: 8, nano: 8 }), {
      tierMix: quantity.mix,
      targetCount: quantity.recommended!,
      preferredCategories: ["food"],
    });
    return {
      recommended: quantity.recommended,
      allocated: quantity.mix.reduce((sum, tier) => sum + (tier.count ?? 0), 0),
      slate: creators.length,
    };
  });

  assert.deepEqual(seen.map((s) => s.recommended), sizes);
  assert.deepEqual(seen.map((s) => s.allocated), sizes);
  assert.deepEqual(seen.map((s) => s.slate), sizes);
});

test("requested 20 is not clipped by the 10 or 16 ceilings", () => {
  const quantity = deriveCreatorQuantityRecommendation(
    facts({ requestedCreatorCount: 20 }),
    { tierMix: STRATEGY_MIX }
  );
  assert.equal(quantity.recommended, 20, "MAX_SLATE=16 must not clamp an explicit request");

  const { creators, meta } = composeCreatorSlate(pool({ macro: 10, micro: 10, nano: 10 }), {
    tierMix: quantity.mix,
    targetCount: 20,
    preferredCategories: ["food"],
  });
  assert.equal(creators.length, 20, "MAX_QUALITY_SLATE=10 must not clamp an explicit request");
  assert.equal(meta.targetCount, 20);
  assert.equal(meta.achievedCount, 20);
});

test("no requested quantity leaves the existing heuristic untouched", () => {
  const withoutRequest = deriveCreatorQuantityRecommendation(facts(), {
    tierMix: STRATEGY_MIX,
  });
  // 2-week flight, awareness objective, one platform, no budget → the
  // established evidence-based answer, unchanged by this work.
  assert.equal(withoutRequest.recommended, 5);
  assert.equal(withoutRequest.confidence, 0.64);
  assert.equal(facts().requestedCreatorCount, undefined);
});

test("a quantity stated in the brief reaches Campaign Facts with no new parsing", () => {
  const profile = {
    schemaVersion: 1,
    status: "saved",
    extractedAt: "",
    confidence: {},
    sources: {},
    brandName: "Tafareeh Tea",
    expectedCreatorCount: 12,
  } as unknown as CampaignIntelligenceProfile;

  assert.equal(profileToCampaignFacts(profile).requestedCreatorCount, 12);
});

test("a brief with no stated quantity produces no requested quantity", () => {
  const profile = {
    schemaVersion: 1,
    status: "saved",
    extractedAt: "",
    confidence: {},
    sources: {},
    brandName: "Tafareeh Tea",
  } as unknown as CampaignIntelligenceProfile;

  assert.equal(profileToCampaignFacts(profile).requestedCreatorCount, undefined);
});

test("the operator's Intake entry overrides the brief-stated quantity", () => {
  const fromBrief = facts({ requestedCreatorCount: 10 });
  const edited = campaignFactsFromIntakeEdit({ requestedCreatorCount: 12 }, fromBrief);
  assert.equal(edited.requestedCreatorCount, 12);
  assert.equal(edited.sources.requestedCreatorCount, "operator");

  // No entry keeps whatever the brief gave.
  assert.equal(campaignFactsFromIntakeEdit({}, fromBrief).requestedCreatorCount, 10);
});

test("requested creators is optional at Intake and never blocks confirmation", () => {
  const intake = requiredIntakeFacts(
    facts({
      clientName: "Tafareeh Tea",
      product: "Ramadan Push",
      geography: ["Egypt"],
    })
  );
  const row = intake.rows.find((r) => r.key === "requestedCreators");
  assert.ok(row, "the row must be visible");
  assert.equal(row!.required, false);
  assert.equal(row!.state, "missing");
  assert.ok(!intake.missing.some((r) => r.key === "requestedCreators"));
});

// ---------------------------------------------------------------------------
// Strategy mix authority and tier shortage

test("the Strategy mix drives the slate composition", () => {
  const quantity = deriveCreatorQuantityRecommendation(
    facts({ requestedCreatorCount: 10 }),
    { tierMix: STRATEGY_MIX }
  );
  const { creators, meta } = composeCreatorSlate(pool({ macro: 8, micro: 8, nano: 8 }), {
    tierMix: quantity.mix,
    targetCount: 10,
    preferredCategories: ["food"],
  });

  assert.deepEqual(tierCounts(creators), { macro: 4, micro: 4, nano: 2 });
  assert.deepEqual(
    meta.requestedMix.map((m) => `${m.tier} ${m.percent}`),
    ["Macro 40", "Micro 35", "Nano 25"]
  );
  assert.equal(meta.tierShortfall, undefined);
});

test("an unrequested tier is never substituted to fill the number", () => {
  // Only 2 Macro exist; Celebrity and Mega are plentiful and would have filled
  // the gap under the old untiered backfill.
  const { creators } = composeCreatorSlate(
    pool({ macro: 2, micro: 4, nano: 2, mega: 20, celebrity: 20 }),
    { tierMix: STRATEGY_MIX, targetCount: 10, preferredCategories: ["food"] }
  );

  const counts = tierCounts(creators);
  assert.equal(counts.celebrity ?? 0, 0, "Celebrity was never requested by the Strategy");
  assert.equal(counts.mega ?? 0, 0, "Mega was never requested by the Strategy");
  for (const c of creators) {
    assert.ok(["macro", "micro", "nano"].includes(c.id.split("-")[0]!));
  }
});

test("a tier shortage is exposed rather than hidden", () => {
  const { creators, meta } = composeCreatorSlate(
    pool({ macro: 1, micro: 4, nano: 2, mega: 20 }),
    { tierMix: STRATEGY_MIX, targetCount: 10, preferredCategories: ["food"] }
  );

  assert.equal(meta.targetCount, 10);
  assert.equal(meta.achievedCount, creators.length);
  assert.ok(creators.length < 10, "the mix could not supply 10 on-strategy creators");
  assert.ok(meta.tierShortfall && meta.tierShortfall.length > 0);
  const macro = meta.tierShortfall!.find((t) => t.tier === "Macro");
  assert.ok(macro, "the under-supplied tier must be named");
  assert.ok(macro!.achieved < macro!.requested);
  assert.ok(meta.achievedMix.length > 0, "the achieved mix must be reported");
});

test("a tier with spare supply covers for one that ran dry, staying on strategy", () => {
  // No Nano at all, but plenty of Macro and Micro — the requested quantity is
  // still reached, using only tiers the Strategy named.
  const { creators, meta } = composeCreatorSlate(pool({ macro: 12, micro: 12, celebrity: 20 }), {
    tierMix: STRATEGY_MIX,
    targetCount: 10,
    preferredCategories: ["food"],
  });

  assert.equal(creators.length, 10, "spare on-strategy supply should still reach the target");
  assert.equal(tierCounts(creators).celebrity ?? 0, 0);
  assert.ok(meta.tierShortfall?.some((t) => t.tier === "Nano"), "the Nano gap is still reported");
});

test("with no tier mix the slate keeps its existing plain-ranking behaviour", () => {
  const { creators, meta } = composeCreatorSlate(pool({ macro: 4, celebrity: 4 }), {
    targetCount: 6,
  });
  assert.equal(creators.length, 6);
  assert.deepEqual(meta.requestedMix, []);
  assert.equal(meta.targetCount, 6);
});

test("a creator with no follower data is not treated as an off-strategy tier", () => {
  // No followers → tier "Unknown". That is missing data, not a substitution:
  // dropping these emptied slates built from sources without follower counts.
  const unclassified = Array.from({ length: 6 }, (_, i) => ({
    ...card("micro", i),
    id: `unknown-${i}`,
    followers: undefined,
  })) as unknown as SearchCreatorCardItem[];

  const { creators } = composeCreatorSlate(unclassified, {
    tierMix: STRATEGY_MIX,
    targetCount: 5,
  });
  assert.equal(creators.length, 5);
});

test("the shortlist suggestion cap still protects an unsized ranking", () => {
  // Scout hands over a raw search ranking, not a composed slate — the
  // established 10-creator suggestion cap must still apply there.
  const ranked = Array.from({ length: 25 }, (_, i) => ({
    id: `c-${i}`,
    handle: `c_${i}`,
    displayName: `Creator ${i}`,
    platform: "instagram",
    followers: 50_000,
    fitScore: 80,
    rank: i + 1,
  })) as unknown as Parameters<typeof formatShortlistSuggestion>[0];

  assert.equal(formatShortlistSuggestion(ranked, "q").creatorIds.length, 10);
  // A caller whose list IS the composed slate opts out explicitly.
  assert.equal(formatShortlistSuggestion(ranked, "q", ranked.length).creatorIds.length, 25);
});
