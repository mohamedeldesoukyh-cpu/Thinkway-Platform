import assert from "node:assert/strict";
import { test } from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  confirmCampaignIntelligenceProfile,
  projectConfirmedCampaignFacts,
} from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import {
  generateCampaignOutput,
  getCampaignOutput,
  markStaleCampaignOutputs,
  regenerateStaleCampaignOutputs,
} from "@/features/campaign-outputs/output-registry";
import { buildCampaignObjectFixture, type FixtureCreator } from "@/features/campaign-outputs/output-test-fixture";

import { applyBudgetChange, applyTimelineChange } from "./copilot/campaign-facts-mutations";
import { deriveCreatorQuantityRecommendation } from "./creator-quantity";
import { outdatedStudioSections } from "./studio-facts-freshness";
import { confirmStudioIntakeOnCampaignObject } from "./studio-intake-facts";
import {
  canCreateClientReview,
  firstPackageFixTarget,
  resolveStudioPackageReadiness,
} from "./studio-package-readiness";

const ARAB_BANK_BRIEF = [
  "Client: Arab Bank.",
  "Brand: Arab Bank.",
  "Product: Credit Card Instant Issuance.",
  "Market: Egypt.",
  "Budget: EGP 5,000,000.",
  "Duration: 1 month.",
  "Objective: Awareness and acquisition.",
].join(" ");

const EMPTY_DRAFT = { changes: [], updatedAt: "" };

const GENERATED_KINDS = [
  "full_strategy",
  "media_plan",
  "budget_allocation",
  "executive_proposal",
  "content_calendar",
] as const;

function arabBankCreators(count: number): FixtureCreator[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cr_ab_${index + 1}`,
    name: `Arab Bank Creator ${index + 1}`,
    tier: index === 0 ? "Celebrity" : index < 4 ? "Macro" : "Micro",
  }));
}

function arabBankObject(options?: { creatorCount?: number }): CampaignObject {
  const extracted = extractCampaignFacts({ rawMessage: ARAB_BANK_BRIEF });
  const confirmed = confirmCampaignIntelligenceProfile({
    ...createEmptyCampaignIntelligenceProfile(),
    ...extracted,
    schemaVersion: 1,
    status: "saved",
    campaignName: "Credit Card Instant Issuance",
    market: "Egypt",
    products: ["Credit Card Instant Issuance"],
    objectives: ["Awareness", "acquisition"],
  });
  const facts = projectConfirmedCampaignFacts(confirmed);
  assert.ok(facts);

  const creatorCount =
    options?.creatorCount ?? deriveCreatorQuantityRecommendation(facts).recommended ?? 11;
  const object = buildCampaignObjectFixture({
    creators: arabBankCreators(creatorCount),
    facts: {
      clientName: "Arab Bank",
      brandName: "Arab Bank",
      product: "Credit Card Instant Issuance",
      objective: facts!.objective,
      audience: facts!.audience ?? "Egypt professionals considering a new credit card",
      geography: facts!.geography?.length ? facts!.geography : ["Egypt"],
      platforms: facts!.platforms?.length ? facts!.platforms : ["Instagram", "TikTok"],
      budget: facts!.budget,
      durationWeeks: facts!.durationWeeks,
    },
  });

  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  object.sections.creators.data = {
    ...creatorsData,
    phase: "proposal",
    discovery: { creatorIds: ids, total: Math.max(ids.length * 3, 24) },
    lastDiscoveryAt: new Date().toISOString(),
  } as unknown as Record<string, unknown>;

  return confirmStudioIntakeOnCampaignObject(object, {
    ...getCampaignFacts(object)!,
    ...facts!,
    clientName: "Arab Bank",
    brandName: "Arab Bank",
    product: "Credit Card Instant Issuance",
    geography: ["Egypt"],
    budget: { amount: 5_000_000, currency: "EGP" },
    durationWeeks: 4,
  });
}

function generatePlanningPackage(campaignObject: CampaignObject): CampaignObject {
  let next = campaignObject;
  for (const kind of GENERATED_KINDS) {
    ({ campaignObject: next } = generateCampaignOutput(next, kind));
  }
  return next;
}

function readinessOf(campaignObject: CampaignObject) {
  return resolveStudioPackageReadiness(
    campaignObject,
    outdatedStudioSections(campaignObject, EMPTY_DRAFT)
  );
}

function checkState(campaignObject: CampaignObject, id: string) {
  return readinessOf(campaignObject).checks.find((item) => item.id === id)?.state;
}

function stripBudget(campaignObject: CampaignObject): CampaignObject {
  const facts = getCampaignFacts(campaignObject);
  const next: CampaignObject = {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      campaignFacts: facts ? { ...facts, budget: undefined } : facts,
    },
    updatedAt: new Date().toISOString(),
  };
  return markStaleCampaignOutputs(next);
}

function removeCreator(campaignObject: CampaignObject, creatorId: string): CampaignObject {
  const creatorsData = {
    ...((campaignObject.sections.creators.data ?? {}) as CreatorsSectionData),
  };
  const recommendations = creatorsData.recommendations;
  creatorsData.recommendations = {
    ...recommendations,
    creatorIds: (recommendations?.creatorIds ?? []).filter((id) => id !== creatorId),
    selectedReasoning: (recommendations?.selectedReasoning ?? []).filter(
      (entry) => entry.creatorId !== creatorId
    ),
  };
  if (creatorsData.discovery?.creatorIds) {
    creatorsData.discovery = {
      ...creatorsData.discovery,
      creatorIds: creatorsData.discovery.creatorIds.filter((id) => id !== creatorId),
    };
  }
  const next: CampaignObject = {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: creatorsData as unknown as Record<string, unknown>,
      },
    },
    updatedAt: new Date().toISOString(),
  };
  return markStaleCampaignOutputs(next);
}

test("Arab Bank 4-week package is READY FOR CLIENT when intelligence is current and consistent", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const facts = getCampaignFacts(generated);
  assert.equal(facts?.clientName, "Arab Bank");
  assert.equal(facts?.product, "Credit Card Instant Issuance");
  assert.deepEqual(facts?.geography, ["Egypt"]);
  assert.equal(facts?.budget?.amount, 5_000_000);
  assert.equal(facts?.budget?.currency, "EGP");
  assert.equal(facts?.durationWeeks, 4);

  const quantity = deriveCreatorQuantityRecommendation(facts);
  assert.ok(quantity.recommended);
  assert.notEqual(quantity.recommended, 10);
  assert.ok((quantity.recommended ?? 0) >= 6);
  assert.ok((quantity.recommended ?? 0) <= 16);

  const ready = readinessOf(generated);
  const byId = Object.fromEntries(ready.checks.map((item) => [item.id, item]));
  assert.ok(["current", "ready"].includes(byId.intake?.state ?? ""));
  assert.equal(byId.strategy?.state, "ready");
  assert.equal(byId.discovery?.state, "ready");
  assert.equal(byId.creators?.state, "ready");
  assert.equal(byId.content?.state, "ready");
  assert.equal(byId.commercial?.state, "ready");
  assert.equal(byId.timeline?.state, "ready");
  assert.equal(byId.proposal?.state, "ready");
  assert.equal(byId.presentation?.state, "ready");
  assert.equal(ready.overall, "ready_for_client");
  assert.equal(ready.readyForClient, true);
  assert.equal(canCreateClientReview(ready), true);
  assert.equal(ready.sourceState.durationWeeks, 4);
  assert.equal(ready.sourceState.budgetAmount, 5_000_000);
  assert.equal(ready.sourceState.creatorIds.length, quantity.recommended);
  assert.ok(!JSON.stringify(ready.checks).includes("fingerprint"));
});

test("A. Strategy exists but is stale → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  assert.equal(checkState(stale, "strategy"), "outdated");
  assert.equal(readinessOf(stale).readyForClient, false);
});

test("B. Discovery returns zero → NOT READY", () => {
  const object = arabBankObject({ creatorCount: 11 });
  const empty: CreatorsSectionData = {
    phase: "proposal",
    lastDiscoveryAt: new Date().toISOString(),
    discovery: { creatorIds: [], total: 0 },
    recommendations: { creatorIds: [], selectedReasoning: [] },
  };
  object.sections.creators.data = empty as unknown as Record<string, unknown>;
  const generated = generatePlanningPackage(object);
  const ready = readinessOf(generated);
  assert.equal(ready.checks.find((item) => item.id === "discovery")?.state, "blocked");
  assert.equal(ready.readyForClient, false);
  assert.match(ready.checks.find((item) => item.id === "discovery")?.reason ?? "", /inventory|matching/i);
});

test("C. Discovery requires enrichment → NOT READY when evidence is insufficient", () => {
  const object = arabBankObject({ creatorCount: 11 });
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  creatorsData.recommendations = {
    ...creatorsData.recommendations,
    creatorIds: creatorsData.recommendations?.creatorIds ?? [],
    selectedReasoning: (creatorsData.recommendations?.selectedReasoning ?? []).map((entry) => ({
      ...entry,
      missingData: ["Audience quality"],
    })),
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  const generated = generatePlanningPackage(object);
  const ready = readinessOf(generated);
  assert.equal(ready.checks.find((item) => item.id === "discovery")?.state, "blocked");
  assert.equal(ready.readyForClient, false);
});

test("D. Creator quantity has no evidence → NOT READY", () => {
  const object = stripBudget(generatePlanningPackage(arabBankObject()));
  const ready = readinessOf(object);
  const creators = ready.checks.find((item) => item.id === "creators");
  assert.equal(creators?.state, "blocked");
  assert.match(creators?.reason ?? "", /budget is not confirmed/i);
  assert.equal(ready.readyForClient, false);
});

test("E. Content exists but belongs to an old creator slate → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const removed = removeCreator(generated, generated.meta.campaignFacts ? "cr_ab_11" : "cr_ab_11");
  const ready = readinessOf(removed);
  assert.notEqual(ready.checks.find((item) => item.id === "content")?.state, "ready");
  assert.equal(ready.readyForClient, false);
});

test("F. Commercial exists but budget changed → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyBudgetChange(generated, {
    amount: 3_000_000,
    currency: "EGP",
  });
  const ready = readinessOf(stale);
  assert.equal(ready.checks.find((item) => item.id === "intake")?.state, "current");
  assert.ok(["outdated", "blocked"].includes(ready.checks.find((item) => item.id === "commercial")?.state ?? ""));
  assert.equal(ready.readyForClient, false);
  assert.equal(canCreateClientReview(ready), false);
});

test("G. Timeline says 4 weeks while Facts says 6 → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  const ready = readinessOf(stale);
  assert.equal(getCampaignFacts(stale)?.durationWeeks, 6);
  assert.equal(ready.checks.find((item) => item.id === "intake")?.state, "current");
  assert.ok(["outdated", "blocked"].includes(ready.checks.find((item) => item.id === "timeline")?.state ?? ""));
  assert.equal(ready.overall === "ready_for_client", false);
  assert.equal(canCreateClientReview(ready), false);
});

test("H. Proposal generated before facts change → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  assert.equal(getCampaignOutput(stale, "executive_proposal")?.status, "needs_update");
  assert.equal(checkState(stale, "proposal"), "outdated");
  assert.equal(readinessOf(stale).readyForClient, false);
});

test("I. Presentation generated before creator change → NOT READY", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const stale = removeCreator(generated, "cr_ab_1");
  const ready = readinessOf(stale);
  assert.ok(["outdated", "blocked"].includes(ready.checks.find((item) => item.id === "presentation")?.state ?? ""));
  assert.equal(ready.readyForClient, false);
});

test("J. Everything exists/current/consistent → READY", () => {
  const ready = readinessOf(generatePlanningPackage(arabBankObject()));
  assert.equal(ready.overall, "ready_for_client");
  assert.equal(ready.attentionCount, 0);
});

test("duration 4 → 6 weeks marks package outdated; regen restores 6 weeks everywhere", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  const before = readinessOf(stale);
  assert.equal(before.checks.find((item) => item.id === "intake")?.state, "current");
  assert.equal(before.readyForClient, false);
  assert.equal(canCreateClientReview(before), false);

  const refreshed = regenerateStaleCampaignOutputs(stale);
  assert.equal(getCampaignFacts(refreshed)?.durationWeeks, 6);
  assert.equal(
    (getCampaignOutput(refreshed, "content_calendar")?.content.data as { durationWeeks?: number } | undefined)
      ?.durationWeeks,
    6
  );
  const proposalText = JSON.stringify(getCampaignOutput(refreshed, "executive_proposal")?.content);
  assert.match(proposalText, /6-week|6 weeks/i);
  assert.doesNotMatch(proposalText, /4-week flight|over 4 weeks/i);
  const after = readinessOf(refreshed);
  assert.equal(after.checks.find((item) => item.id === "timeline")?.state, "ready");
  assert.equal(after.overall, "ready_for_client");
  assert.equal(after.sourceState.durationWeeks, 6);
});

test("budget EGP 5M → 3M cannot remain READY FOR CLIENT; regen reflects 3M", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyBudgetChange(generated, {
    amount: 3_000_000,
    currency: "EGP",
  });
  const before = readinessOf(stale);
  assert.equal(before.readyForClient, false);
  assert.ok(before.attentionCount >= 1);

  const refreshed = regenerateStaleCampaignOutputs(stale);
  const proposalText = JSON.stringify(getCampaignOutput(refreshed, "executive_proposal")?.content);
  assert.match(proposalText, /3,000,000/);
  assert.doesNotMatch(proposalText, /5,000,000/);
  const after = readinessOf(refreshed);
  assert.equal(getCampaignFacts(refreshed)?.budget?.amount, 3_000_000);
  assert.equal(after.checks.find((item) => item.id === "commercial")?.state, "ready");
  assert.equal(after.overall, "ready_for_client");
});

test("creator slate change does not leave downstream package dimensions falsely current", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const stale = removeCreator(generated, "cr_ab_2");
  const ready = readinessOf(stale);
  assert.equal(ready.checks.find((item) => item.id === "creators")?.state, "ready");
  assert.notEqual(ready.checks.find((item) => item.id === "content")?.state, "ready");
  assert.notEqual(ready.checks.find((item) => item.id === "commercial")?.state, "ready");
  assert.notEqual(ready.checks.find((item) => item.id === "proposal")?.state, "ready");
  assert.notEqual(ready.checks.find((item) => item.id === "presentation")?.state, "ready");
  assert.equal(ready.readyForClient, false);
});

test("missing budget is not invented and blocks Commercial plus Client Review", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const missing = stripBudget(generated);
  assert.equal(getCampaignFacts(missing)?.budget, undefined);
  const ready = readinessOf(missing);
  assert.equal(ready.checks.find((item) => item.id === "intake")?.state, "current");
  const commercial = ready.checks.find((item) => item.id === "commercial");
  assert.equal(commercial?.state, "blocked");
  assert.match(commercial?.reason ?? "", /Budget is required to finalize Commercial/i);
  assert.doesNotMatch(commercial?.reason ?? "", /system error/i);
  assert.equal(ready.readyForClient, false);
  assert.equal(canCreateClientReview(ready), false);
  assert.equal(firstPackageFixTarget(ready), "intake");
});

test("Create Client Review is blocked unless overall is READY FOR CLIENT", () => {
  const ready = readinessOf(generatePlanningPackage(arabBankObject()));
  assert.equal(canCreateClientReview(ready), true);
  const stale = readinessOf(applyTimelineChange(generatePlanningPackage(arabBankObject()), { durationWeeks: 6 }).campaignObject);
  assert.equal(canCreateClientReview(stale), false);
  assert.ok(stale.clientReviewBlockers.length >= 1);
});

test("regeneration recomputes readiness from the updated campaign object", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  assert.equal(readinessOf(stale).readyForClient, false);
  const refreshed = regenerateStaleCampaignOutputs(stale);
  assert.equal(readinessOf(refreshed).readyForClient, true);
  assert.equal(readinessOf(refreshed).sourceState.durationWeeks, 6);
});

test("PDF/PPTX existence is not readiness — stale generated outputs stay not ready", () => {
  const generated = generatePlanningPackage(arabBankObject());
  assert.equal(getCampaignOutput(generated, "executive_proposal")?.status, "generated");
  const { campaignObject: stale } = applyBudgetChange(generated, {
    amount: 3_000_000,
    currency: "EGP",
  });
  assert.equal(getCampaignOutput(stale, "executive_proposal")?.status, "needs_update");
  assert.equal(readinessOf(stale).readyForClient, false);
});
