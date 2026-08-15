import assert from "node:assert/strict";
import { test } from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { jobOutcomeLabel } from "@/features/discovery/components/discovery-job-feedback";

import { deriveCreatorQuantityRecommendation } from "./creator-quantity";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { deriveInfluencerStrategyView } from "./influencer-strategy-view";
import { resolveContentPlan } from "./section-data-resolver";
import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";

const ARAB_BANK_BRIEF = [
  "Client: Arab Bank.",
  "Brand: Arab Bank.",
  "Product: Credit Card Instant Issuance.",
  "Market: Egypt.",
  "Budget: EGP 5,000,000.",
  "Duration: 1 month.",
  "Objective: Awareness and acquisition.",
].join(" ");

function arabBankObject(overrides?: Partial<CampaignObject>): CampaignObject {
  const extracted = extractCampaignFacts({ rawMessage: ARAB_BANK_BRIEF });
  const object = createEmptyCampaignObject({
    id: "arab-bank-wave2",
    conversationId: "conv-arab-bank",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.meta.campaignFacts = {
    ...extracted,
    clientName: "Arab Bank",
    brandName: "Arab Bank",
    product: "Credit Card Instant Issuance",
    objective: "Awareness and acquisition",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    budget: { amount: 5_000_000, currency: "EGP" },
    durationWeeks: 4,
    kpis: ["Awareness reach", "Card applications"],
    deliverables: ["IG Reels", "TikTok videos"],
  };
  return { ...object, ...overrides };
}

function withSlate(object: CampaignObject): CampaignObject {
  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    discovery: { creatorIds: ["cr_nour", "cr_layla"], total: 24 },
    recommendations: {
      creatorIds: ["cr_nour", "cr_layla"],
      selectedReasoning: [
        {
          creatorId: "cr_nour",
          displayName: "Nour Star",
          platform: "instagram",
          handle: "@nour",
          whySelected: "High-trust finance educator for card issuance",
          expectedRole: "Macro",
          audienceMatch: "Egypt professionals 25–44",
          risk: "Low",
          alternative: "Layla Macro",
          confidence: 0.82,
          evidence: "Category fit + audience Egypt",
          tradeoff: "Higher fee than micro",
        },
        {
          creatorId: "cr_layla",
          displayName: "Layla Macro",
          platform: "tiktok",
          handle: "@layla",
          whySelected: "Acquisition-oriented lifestyle proof",
          expectedRole: "Micro",
          audienceMatch: "Egypt 22–34",
          risk: "Medium",
          alternative: "Nour Star",
          confidence: 0.74,
          evidence: "TikTok conversion content",
          tradeoff: "Smaller reach",
        },
      ],
    },
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  object.sections.strategy.data = {
    creativeConcepts: [
      {
        name: "Instant issuance proof",
        bigIdea: "Show the card arriving in-branch in under 10 minutes",
        hook: "Watch this card print while you wait",
        keyVisual: "Branch counter time-lapse",
        contentTheme: "Speed and trust for Egypt credit-card acquisition",
        cta: "Visit Arab Bank and issue your card today",
        sampleCaption: "From approval to card in hand.",
        hashtags: ["#ArabBank"],
      },
    ],
  };
  return object;
}

test("Arab Bank quantity is evidence-based and not a silent default of 10", () => {
  const facts = arabBankObject().meta.campaignFacts;
  const quantity = deriveCreatorQuantityRecommendation(facts);
  assert.ok(quantity.recommended);
  assert.notEqual(quantity.recommended, 10);
  assert.ok((quantity.recommended ?? 0) >= 6);
  assert.ok((quantity.recommended ?? 0) <= 16);
  assert.match(quantity.rationale, /5,000,000 EGP|5,000,000/);
  assert.match(quantity.rationale, /4-week|4 week/i);
  assert.doesNotMatch(quantity.rationale, /default 10|capped at 10/i);
  assert.ok(quantity.evidence.some((line) => /awareness plus acquisition/i.test(line)));
  assert.ok(quantity.confidence >= 0.8);
});

test("missing facts do not invent a quantity of 10", () => {
  const quantity = deriveCreatorQuantityRecommendation({
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  });
  assert.equal(quantity.recommended, null);
  assert.equal(quantity.confidence, 0);
  assert.match(quantity.rationale, /cannot be set/i);
});

test("one influencer Strategy answers the planning checklist", () => {
  const answers = deriveInfluencerStrategyView(arabBankObject());
  const byKey = Object.fromEntries(answers.map((answer) => [answer.key, answer.body]));
  assert.equal(answers.length, 11);
  assert.match(byKey.objective ?? "", /awareness/i);
  assert.match(byKey.audience ?? "", /Egypt|audience|Insufficient/i);
  assert.match(byKey.quantity ?? "", /creators/i);
  assert.doesNotMatch(byKey.quantity ?? "", /default 10/i);
  assert.match(byKey.platformStrategy ?? "", /Instagram|TikTok|platform/i);
  assert.ok(byKey.influencerStrategy);
  assert.ok(byKey.creatorTiers);
  assert.ok(byKey.commercial);
  assert.ok(byKey.risks);
  assert.ok(byKey.decisions);
});

test("Studio Discovery never uses a No creators found dead end", () => {
  const ready = resolveStudioDiscoverySufficiency(arabBankObject(), false);
  assert.equal(ready.state, "discovery_ready");
  assert.doesNotMatch(`${ready.title} ${ready.detail}`, /No creators found/i);

  const emptyAfterSearch = arabBankObject();
  emptyAfterSearch.sections.creators.data = {
    lastDiscoveryAt: new Date().toISOString(),
    slateProposalStatus: {
      status: "blocked",
      reason: "no_discovery_results",
      message: "No discovery results",
      updatedAt: new Date().toISOString(),
    },
  } satisfies CreatorsSectionData as unknown as Record<string, unknown>;
  const noInventory = resolveStudioDiscoverySufficiency(emptyAfterSearch, false);
  assert.equal(noInventory.state, "no_inventory");
  assert.match(noInventory.detail, /inventory gap/i);
  assert.doesNotMatch(`${noInventory.title} ${noInventory.detail}`, /No creators found/i);

  const running = resolveStudioDiscoverySufficiency(arabBankObject(), true);
  assert.equal(running.state, "acquisition_running");

  const sufficient = resolveStudioDiscoverySufficiency(withSlate(arabBankObject()), false);
  assert.equal(sufficient.state, "discovery_sufficient");

  assert.notEqual(jobOutcomeLabel("empty"), "No creators found");
  assert.match(jobOutcomeLabel("empty"), /Inventory empty|broaden|acquisition/i);
});

test("content plan is per-creator and traces to Strategy, not a generic platform table", () => {
  const plan = deriveInfluencerContentPlan(withSlate(arabBankObject()));
  assert.equal(plan.length, 2);
  assert.equal(plan[0]?.creatorName, "Nour Star");
  assert.equal(plan[0]?.creatorRole, "Macro");
  assert.ok(plan[0]?.hook);
  assert.ok(plan[0]?.cta);
  assert.ok(plan[0]?.keyMessage);
  assert.ok(plan[0]?.expectedKpi);
  assert.match(plan[0]?.strategyTrace ?? "", /Strategy:/);
  assert.equal(plan[0]?.quantity, 1);

  const resolved = resolveContentPlan(withSlate(arabBankObject()));
  assert.equal(resolved[0]?.creatorId, "cr_nour");
  assert.ok(resolved.every((row) => row.creatorId));
});

test("generic stored content plan is not shown once a slate exists", () => {
  const object = withSlate(arabBankObject());
  object.sections.timeline.data = {
    contentPlan: [
      {
        platform: "TikTok",
        contentType: "Videos",
        creatorTier: "Micro",
        quantity: 5,
        postingDate: "Week 1",
        objective: "Awareness",
      },
    ],
  };
  const resolved = resolveContentPlan(object);
  assert.ok(resolved.every((row) => row.creatorId));
  assert.equal(resolved.some((row) => row.contentType === "Videos" && row.quantity === 5), false);
});
