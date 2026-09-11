/**
 * The five findings from the Dev acceptance pass after 51bf24a9.
 *
 *   1. Creator Details' Campaign tab showed a scrollbar but could not be
 *      scrolled to its lower content.
 *   2. It opened with "Not Recommended: do not prioritize esraafahmy for this
 *      campaign", a decision narrative, and "Business value: High Risk".
 *   3. Creators showed 7 creators, Content said "Working campaign slate · 6
 *      creators".
 *   4. Creator cards showed "#3", "#4" with no "#1".
 *   5. `aber_kitchen`, a Food creator, was offered as a replacement on a
 *      premium-haircare campaign.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { filterExecutionCreatorIds } from "@/lib/domains/commercial/campaign-plan-execution-mapper";

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import {
  checkCreatorSlateIntegrity,
  withSlatePositions,
} from "./creator-slate-integrity";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { resolveCreatorCounts } from "./section-data-resolver";
import { containsInternalTerminology } from "./studio-creator-client-decision";
import {
  containsPrescriptiveLanguage,
  creatorFactualIntelligence,
} from "./studio-creator-factual-intelligence";
import { creatorGroupingKey } from "./studio-creator-slate-split";
import { classifyReplacementCandidates } from "./studio-replacement-candidates";
import {
  orderReplacementCandidatesByRole,
  replacementCandidateIsEligible,
  replacementShortageNote,
} from "./studio-replacement-eligibility";

const read = (file: string) => readFileSync(file, "utf8");
const stamped = new Date().toISOString();

// ---------------------------------------------------------------------------
// The campaign: 7 ids, 6 reasoning rows.

const SEVEN = Array.from({ length: 7 }, (_, i) => `inf:k${i + 1}`);

function row(id: string, index: number): VendorSelectedReasoning {
  return {
    creatorId: id,
    displayName: `Creator ${index + 1}`,
    platform: index % 2 === 0 ? "instagram" : "tiktok",
    whySelected: `Egyptian haircare audience ${index + 1}`,
    expectedRole: index < 3 ? "Mid" : "Micro",
    audienceMatch: "Egypt 20–40",
    risk: "Low",
    alternative: "—",
    confidence: 0.7,
    evidence: "Category + market",
    tradeoff: "—",
  };
}

function kerastase(reasoningCount = 6): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-pass4",
    conversationId: "conv-pass4",
    workflowId: "create-campaign",
  });
  object.meta.factsConfirmedAt = stamped;
  object.meta.campaignFacts = {
    extractedAt: stamped,
    confidence: {},
    sources: {},
    clientName: "Kérastase",
    brandName: "Kérastase",
    product: "premium haircare",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
    industry: "Beauty & Personal Care",
  } as CampaignFacts;

  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    discovery: { creatorIds: [...SEVEN], total: 62 },
    recommendations: {
      creatorIds: [...SEVEN],
      selectedReasoning: SEVEN.slice(0, reasoningCount).map(row),
    },
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  return object;
}

const contentIds = (object: CampaignObject, draft?: { changes: StudioDraftChange[]; updatedAt: string }) =>
  deriveInfluencerContentPlan(object, draft).map((item) => item.creatorId!);

// ---------------------------------------------------------------------------
// 3. Every consumer reads one membership set.

test("3. creatorIds 7 / selectedReasoning 6 — every consumer reports 7", () => {
  const object = kerastase(6);
  const data = object.sections.creators.data as CreatorsSectionData;
  assert.equal(data.recommendations?.creatorIds?.length, 7);
  assert.equal(data.recommendations?.selectedReasoning?.length, 6);

  assert.deepEqual(contentIds(object), SEVEN, "Content");
  assert.deepEqual(filterExecutionCreatorIds(object), SEVEN, "Package / execution");
  assert.equal(resolveCreatorCounts(object).recommendationCount, 7, "Campaign Analysis selectedCount");
  assert.equal(checkCreatorSlateIntegrity(data.recommendations, creatorGroupingKey).consistent, false);
});

test("3. the creator without a reasoning row is present, with no invented data", () => {
  const plan = deriveInfluencerContentPlan(kerastase(6));
  const synthesised = plan.find((item) => item.creatorId === "inf:k7")!;
  assert.ok(synthesised, "the 7th creator is on the plan");
  assert.match(synthesised.hook ?? "", /rationale is not recorded/i);
  assert.equal(synthesised.creatorTier, "Creator", "no tier is guessed");
});

test("3. Content reads the SAME draft preview the Creators screen renders", () => {
  // Root cause of 7-vs-6: the Creators screen renders
  // `previewCreatorsSectionFromDraft`, Content read the raw persisted object, so
  // one staged change put the two screens one creator apart.
  const object = kerastase(6);
  const draft = {
    changes: [
      {
        kind: "add_creator" as const,
        creator: { creatorId: "inf:staged", displayName: "Staged", source: "discovery" as const },
        stagedAt: stamped,
      },
    ],
    updatedAt: stamped,
  };

  assert.equal(contentIds(object).length, 7, "persisted, with no draft");
  assert.equal(contentIds(object, draft).length, 8, "and the staged slate with one");
  assert.ok(contentIds(object, draft).includes("inf:staged"));
});

test("3. add / remove / replace / reject against the drifted state", () => {
  const cases: Array<[string, StudioDraftChange[], (ids: string[]) => void]> = [
    [
      "add",
      [
        {
          kind: "add_creator",
          creator: { creatorId: "inf:new", displayName: "New", source: "discovery" },
          stagedAt: stamped,
        },
      ],
      (ids) => {
        assert.equal(ids.length, 8);
        assert.ok(ids.includes("inf:new"));
      },
    ],
    [
      "remove a creator that had no reasoning row",
      [{ kind: "remove_creator", creatorId: "inf:k7", stagedAt: stamped }],
      (ids) => {
        assert.equal(ids.length, 6);
        assert.ok(!ids.includes("inf:k7"));
      },
    ],
    [
      "replace a creator that had no reasoning row",
      [
        {
          kind: "replace_creator",
          creatorId: "inf:k7",
          replacement: { creatorId: "inf:sub", displayName: "Sub", source: "discovery" },
          stagedAt: stamped,
        },
      ],
      (ids) => {
        assert.equal(ids.length, 7);
        assert.ok(!ids.includes("inf:k7"));
        assert.ok(ids.includes("inf:sub"));
      },
    ],
    [
      "reject",
      [{ kind: "reject_creator", creatorId: "inf:k2", stagedAt: stamped }],
      (ids) => {
        assert.equal(ids.length, 6, "rejected creators leave the plan");
        assert.ok(!ids.includes("inf:k2"));
      },
    ],
  ];

  for (const [name, changes, check] of cases) {
    check(contentIds(kerastase(6), { changes, updatedAt: stamped }));
    void name;
  }
});

// ---------------------------------------------------------------------------
// 4. Slate serials.

test("4. pool ranks 3, 5, 7, 9 become slate positions 1, 2, 3, 4", () => {
  const pool = [
    { id: "a", rank: 3 },
    { id: "b", rank: 5 },
    { id: "c", rank: 7 },
    { id: "d", rank: 9 },
  ];
  assert.deepEqual(
    withSlatePositions(pool).map((item) => item.rank),
    [1, 2, 3, 4]
  );
});

test("4. positions are contiguous however many pool members were dropped", () => {
  for (const size of [1, 3, 7, 10]) {
    const positions = withSlatePositions(
      Array.from({ length: size }, (_, i) => ({ id: `c${i}`, rank: (i + 1) * 4 }))
    ).map((item) => item.rank);
    assert.deepEqual(positions, Array.from({ length: size }, (_, i) => i + 1), String(size));
  }
});

test("4. the recommended list is not stamped with pool positions", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  // The gated pool must no longer carry a serial.
  assert.doesNotMatch(source, /\.map\(\(vendor, index\) => \(\{ \.\.\.vendor, rank: index \+ 1 \}\)\)/);
  assert.match(source, /withSlatePositions\(\[/);
});

// ---------------------------------------------------------------------------
// 5. Replacement eligibility.

type Cand = { id: string; market: boolean; mix: boolean; tier?: string };
const GATES = {
  matchesMarket: (c: Cand) => c.market,
  fitsBriefMix: (c: Cand) => c.mix,
};

test("5. a Food-only creator cannot be offered as a replacement", () => {
  const [aberKitchen] = classifyReplacementCandidates(
    [{ id: "aber_kitchen", market: true, mix: false, tier: "Mid" }],
    GATES
  );
  assert.equal(aberKitchen!.ineligibility, "off_brief_mix");
  assert.equal(
    replacementCandidateIsEligible(aberKitchen!),
    false,
    "off-category is a campaign requirement, not advice"
  );
});

test("5. a Beauty candidate qualifies, and so does a Fashion one", () => {
  for (const id of ["beauty_creator", "fashion_creator"]) {
    const [candidate] = classifyReplacementCandidates(
      [{ id, market: true, mix: true, tier: "Mid" }],
      GATES
    );
    assert.equal(replacementCandidateIsEligible(candidate!), true, id);
  }
});

test("5. an out-of-market candidate is still not offered", () => {
  const [candidate] = classifyReplacementCandidates(
    [{ id: "ksa_beauty", market: false, mix: true }],
    GATES
  );
  assert.equal(replacementCandidateIsEligible(candidate!), false);
});

test("5. an ineligible candidate stays VISIBLE with its reason", () => {
  // Nothing is hidden — it is simply not offered as a replacement.
  const classified = classifyReplacementCandidates(
    [
      { id: "aber_kitchen", market: true, mix: false },
      { id: "beauty", market: true, mix: true },
    ],
    GATES
  );
  assert.equal(classified.length, 2, "both are listed");
  assert.equal(classified.filter(replacementCandidateIsEligible).length, 1);
});

test("5. replacing a Mid creator offers Mid candidates first", () => {
  const ordered = orderReplacementCandidatesByRole(
    [
      { id: "micro1", tier: "Micro" },
      { id: "mid1", tier: "Mid" },
      { id: "macro1", tier: "Macro" },
      { id: "mid2", tier: "Mid" },
    ],
    {
      targetTier: "Mid",
      tierOf: (c) => c.tier,
      approvedTiers: ["Macro", "Mid", "Micro"],
    }
  );
  assert.deepEqual(
    ordered.map((c) => c.id),
    ["mid1", "mid2", "micro1", "macro1"]
  );
});

test("5. a tier the Strategy did not approve cannot enter replacement", () => {
  const ordered = orderReplacementCandidatesByRole(
    [
      { id: "nano1", tier: "Nano" },
      { id: "mid1", tier: "Mid" },
    ],
    { targetTier: "Mid", tierOf: (c) => c.tier, approvedTiers: ["Macro", "Mid", "Micro"] }
  );
  assert.deepEqual(ordered.map((c) => c.id), ["mid1"]);
});

test("5. an unstated tier set disqualifies nobody, and unknown tiers survive", () => {
  const noneStated = orderReplacementCandidatesByRole(
    [{ id: "nano1", tier: "Nano" }, { id: "mid1", tier: "Mid" }],
    { tierOf: (c) => c.tier, approvedTiers: [] }
  );
  assert.equal(noneStated.length, 2, "an unstated requirement cannot exclude a creator");

  const unknownTier = orderReplacementCandidatesByRole(
    [{ id: "unknown", tier: undefined }],
    { targetTier: "Mid", tierOf: (c) => c.tier, approvedTiers: ["Mid"] }
  );
  assert.equal(unknownTier.length, 1, "missing data is missing, not disqualifying");
});

test("5. with no eligible replacement the operator is told why", () => {
  const note = replacementShortageNote({
    consideredCount: 12,
    excludedBy: { off_brief_mix: 11, outside_market: 1 },
  });
  assert.match(note!, /No eligible replacement/i);
  assert.match(note!, /11 outside the campaign's creator categories/);
  assert.match(note!, /1 outside the campaign's market/);
  assert.match(note!, /Browse Discovery/);

  assert.equal(replacementShortageNote({ consideredCount: 0, excludedBy: {} }), null);
});

test("5. platform is never an independent replacement signal", () => {
  const source = read("features/campaign-studio/services/studio-replacement-eligibility.ts");
  assert.doesNotMatch(source, /platformScore|platform_score/i);
  // Nor is ECI.
  assert.doesNotMatch(source, /investmentScore|eciRecommendation/);
});

test("5. Build Shortlist and Discovery ranking are untouched by this change", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  assert.match(source, /ShortlistSlateActions/, "Build Shortlist's entry point still renders");
  assert.match(source, /studioCampaignBrowseFilters/, "Browse Discovery route is intact");
  assert.doesNotMatch(source, /rankCreatorsByCampaignRelevance|scoreCreatorCampaignRelevance/);
});

// ---------------------------------------------------------------------------
// 2. Creator Details is factual.

function signal(overrides: Partial<StudioEciPlanningSignal> = {}): StudioEciPlanningSignal {
  return {
    influencerId: "inf:esraafahmy",
    platform: "instagram",
    investmentScore: 42,
    recommendation: "Not Recommended",
    why: "Weak overall investment score (42) relative to commercial risk tolerance.",
    whyNot: "High Risk — do not prioritize esraafahmy for this campaign.",
    businessObjectiveSupport: "Pursue the alternate path.",
    commercialJustification: "Commercial outlook weak.",
    commercialHealth: "Weak",
    businessReadiness: "Not ready",
    evidence: ["Missing quote reference", "Limited historical evidence"],
    topStrengths: [],
    risks: ["Pricing volatility across recent quotations", "Limited commercial data available"],
    alternatives: [],
    expectedOutcomes: [],
    confidencePercent: 52,
    evidenceCoveragePercent: 38,
    executiveSummary: "Not Recommended",
    layers: {
      investment: "",
      commercial: "",
      audience: "",
      performance: "",
      categoryBrand: "",
      historical: "",
    },
    decision: { what: "", why: "", evidence: "", businessValue: "", alternative: "", whyNot: "" },
    expectedCampaignContribution: "",
    ...overrides,
  };
}

test("2. negative FACTS remain, exactly as measured", () => {
  const facts = creatorFactualIntelligence(signal());
  const byLabel = new Map(facts.measurements.map((row) => [row.label, row.value]));
  assert.equal(byLabel.get("Investment score"), "42/100");
  assert.equal(byLabel.get("Source confidence"), "52%");
  assert.equal(byLabel.get("Data coverage"), "38%");
});

test("2. no prescriptive language reaches Creator Details", () => {
  /*
   * Two surfaces, two boundaries — and the difference is the product decision.
   *
   * The client-facing CARD bars analyst vocabulary AND raw numbers: a bare
   * "Confidence: 52%" there is a reliability reading with no stated basis
   * (`INTERNAL_TERMINOLOGY`). Creator Details is the opposite surface: the
   * measurements are the whole point, and a negative one must stay visible.
   * What is barred here is the PRESCRIPTION.
   */
  const facts = creatorFactualIntelligence(signal());
  const everything = [
    ...facts.measurements.map((row) => `${row.label} ${row.value}`),
    ...facts.observations,
    ...facts.missing,
  ].join(" ");

  assert.equal(containsPrescriptiveLanguage(everything), false, everything);
  for (const phrase of [
    "Not Recommended",
    "do not prioritize",
    "High Risk",
    "alternate path",
    "Commercial outlook weak",
  ]) {
    assert.ok(!everything.includes(phrase), phrase);
  }

  // Analyst prose is still barred from the FREE TEXT, where it could leak.
  const prose = [...facts.observations, ...facts.missing].join(" ");
  assert.equal(containsInternalTerminology(prose), false, prose);
});

test("2. the measurements the card withholds are exactly what Details must show", () => {
  const facts = creatorFactualIntelligence(signal());
  const measured = facts.measurements.map((row) => `${row.label}: ${row.value}`).join(" · ");
  // These trip the CARD's boundary by design, and belong here.
  assert.match(measured, /Investment score: 42\/100/);
  assert.match(measured, /Source confidence: 52%/);
  assert.equal(
    containsInternalTerminology(measured),
    true,
    "which is why the card withholds them and this surface does not"
  );
});

test("2. factual evidence lines survive; verdict-shaped ones do not", () => {
  const facts = creatorFactualIntelligence(signal());
  assert.ok(
    facts.observations.some((line) => /Missing quote reference/i.test(line)),
    JSON.stringify(facts.observations)
  );
  assert.ok(facts.observations.some((line) => /Limited historical evidence/i.test(line)));
  assert.ok(!facts.observations.some((line) => /high risk|do not/i.test(line)));
});

test("2. missing data is named, never softened into a judgement", () => {
  const facts = creatorFactualIntelligence(
    signal({ investmentScore: null, confidencePercent: null, evidenceCoveragePercent: null })
  );
  assert.equal(facts.measurements.length, 0);
  assert.ok(facts.missing.some((line) => /Investment score: not available/i.test(line)));
  assert.ok(facts.missing.some((line) => /Source confidence: not available/i.test(line)));
  assert.equal(containsPrescriptiveLanguage(facts.missing.join(" ")), false);
});

test("2. no signal at all says so, and invents nothing", () => {
  const facts = creatorFactualIntelligence(null);
  assert.deepEqual(facts.measurements, []);
  assert.deepEqual(facts.observations, []);
  assert.equal(facts.missing.length, 1);
  assert.match(facts.missing[0]!, /has not been loaded/i);
});

test("2. no invented positive recommendation replaces the removed one", () => {
  const facts = creatorFactualIntelligence(signal({ investmentScore: 88 }));
  const text = [...facts.observations, ...facts.missing].join(" ");
  assert.doesNotMatch(text, /recommended|strong fit|prioriti[sz]e/i);
});

test("2. the Campaign tab renders the factual projection, not the decision view", () => {
  const block = read(
    "features/campaign-studio/components/sections/shared/studio-executive-recommendation-block.tsx"
  );
  assert.match(block, /creatorFactualIntelligence/);
  // Strip comments: the file documents what it used to render, and that history
  // is worth keeping — it is the CODE that must no longer reach for it.
  const code = block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /toExecutiveCreatorDetailView/);
  assert.doesNotMatch(code, /StudioRecommendationNarrative/);
  assert.doesNotMatch(code, /Executive Recommendation/);
  assert.doesNotMatch(code, /Decision narrative/);
});

test("2. the decision layer still exists for the surfaces that own it", () => {
  // This is a presentation boundary, not a deletion.
  const view = read("features/campaign-studio/services/eci/executive-planning-view.ts");
  assert.match(view, /toExecutiveCreatorDetailView/);
  const cards = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  assert.match(cards, /resolveCampaignCreatorDecision/, "the card still shows the campaign decision");
});

// ---------------------------------------------------------------------------
// 1. The pack's scroll ownership.

test("1. the pack's grid row is bounded, so its body can scroll", () => {
  const css = read("app/styles/discovery-suite-creator-profile.css").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  const blocks = css.split("}").map((block) => {
    const [selectors = "", body = ""] = block.split("{");
    return { selectors: selectors.split(",").map((s) => s.trim()), body };
  });

  const wrapper = blocks.find(
    (block) =>
      block.selectors.some((s) => s.endsWith(".tw-cp__w")) &&
      /grid-template-rows/.test(block.body)
  );
  assert.ok(wrapper, "`max-height` alone is not a definite height for the row");
  assert.match(wrapper!.body, /minmax\(0,\s*1fr\)/);
});

test("1. the body is the only scroller added, and the chrome cannot be squashed", () => {
  const css = read("app/styles/discovery-suite-creator-profile.css").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  // No new overflow declaration: `.tw-cp__b` already owns scrolling in the
  // frozen sheet, so no second nested scrollbar is introduced.
  assert.doesNotMatch(css, /overflow-y:\s*auto/);
  assert.match(css, /\.tw-cp__t\s*\{[^}]*flex:\s*0 0 auto/);
});

test("1. every column may shrink below its content", () => {
  const css = read("app/styles/discovery-suite-creator-profile.css").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  for (const selector of [".tw-cp__w", ".tw-cp__m", ".tw-cp__b"]) {
    const blocks = css.split("}").map((block) => {
      const [selectors = "", body = ""] = block.split("{");
      return { selectors: selectors.split(",").map((s) => s.trim()), body };
    });
    assert.ok(
      blocks.some(
        (block) =>
          block.selectors.some((s) => s.endsWith(selector)) && /min-height:\s*0/.test(block.body)
      ),
      selector
    );
  }
});

test("1. the frozen geometry is untouched", () => {
  const frozen = read("app/styles/discovery.css");
  assert.match(frozen, /\.tw-cp__w\{width:min\(1120px,100%\);max-height:calc\(100vh - 40px\)/);
  assert.match(frozen, /\.tw-cp__b\{flex:1 1 auto;overflow-y:auto/);
});
