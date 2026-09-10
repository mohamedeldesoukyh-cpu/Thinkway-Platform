/**
 * Studio's surfaces must answer the same question the same way.
 *
 * Traced from three contradictions in Dev:
 *
 *   1. Package said "Strategy BLOCKED — influencer strategy has not been
 *      generated from current facts" while the Strategy screen showed a full
 *      strategy. Package read the `full_strategy` OUTPUT record, which only
 *      `ensurePlanningOutputsForHandoff` (Director approval + a slate) or an
 *      explicit generate creates. The Strategy screen reads
 *      `deriveInfluencerStrategyView`. Two authorities, one question.
 *   2. The header said "Ready · 89%", the nav said "Package — Ready", the
 *      Package screen said "Not ready". Three authorities: the mast relabelled
 *      the completion percentage (75%+ = "Ready"), the nav used the presentation
 *      section's own status, and only the Package screen asked the readiness
 *      service.
 *   3. Intake showed "Planning completeness 100%" beside a "Pending" Campaign
 *      Intelligence badge. The badge read the specialist workflow status; the
 *      nav and Package read `meta.factsConfirmedAt` + `requiredIntakeFacts`.
 *
 * The Kérastase state is reproduced below: Egypt confirmed, a generated
 * strategy, a ten-creator slate, no `full_strategy` output record.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";
import { resolveStudioReadinessStatus } from "./studio-readiness-status";
import {
  resolveStudioIntakeDisplayStatus,
  resolveStudioWorkspaceSteps,
} from "./studio-workspace-status";

const STRATEGY = [
  "## Influencer strategy",
  "Recruit Egyptian haircare creators across Macro and Mid tiers to carry the Ramadan story.",
  "",
  "## Platform strategy",
  "Instagram Reels lead reach; TikTok carries the tutorial format for younger cohorts.",
  "",
  "## Content strategy",
  "Salon-result proof, three beats per creator, Arabic-first captions.",
].join("\n");

/** Egypt confirmed, strategy generated, ten creators — the Kérastase state. */
function kerastase(overrides?: {
  factsConfirmedAt?: string | null;
  strategyContent?: string;
  missingCreatorData?: string[];
}): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-state",
    conversationId: "conv-kerastase-state",
    workflowId: "create-campaign",
  });

  const confirmedAt = overrides?.factsConfirmedAt;
  if (confirmedAt !== null) {
    object.meta.factsConfirmedAt = confirmedAt ?? new Date().toISOString();
  }
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    clientName: "Kerastase",
    brandName: "Kerastase",
    product: "Ramadan 2026 haircare",
    objective: "Brand awareness",
    audience: "Women aged 20–40 in Egypt",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 6,
  } as CampaignObject["meta"]["campaignFacts"];

  object.sections.strategy.content = overrides?.strategyContent ?? STRATEGY;
  object.sections.strategy.status = "complete";

  const selectedReasoning = Array.from({ length: 10 }, (_, i) => ({
    creatorId: `inf:c${i + 1}`,
    displayName: `Creator ${i + 1}`,
    handle: `@c${i + 1}`,
    platform: i % 2 === 0 ? "instagram" : "tiktok",
    country: "Egypt",
    whySelected: `Egyptian haircare audience ${i + 1}`,
    expectedRole: i < 4 ? "Macro" : i < 7 ? "Mid" : "Micro",
    audienceMatch: "Egypt 20–40",
    risk: "Low",
    alternative: "—",
    confidence: 0.7,
    evidence: "Category + market",
    tradeoff: "—",
    ...(overrides?.missingCreatorData && i === 0
      ? { missingData: overrides.missingCreatorData }
      : {}),
  }));

  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    discovery: { creatorIds: selectedReasoning.map((r) => r.creatorId), total: 62 },
    recommendations: {
      creatorIds: selectedReasoning.map((r) => r.creatorId),
      selectedReasoning,
    },
    lastDiscoveryAt: new Date().toISOString(),
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  object.sections.creators.status = "complete";
  return object;
}

const strategyCheck = (object: CampaignObject) =>
  resolveStudioPackageReadiness(object).checks.find((check) => check.id === "strategy")!;

// ---------------------------------------------------------------------------
// 1. Strategy: Package judges the Strategy Studio renders.

test("a generated Strategy is not called blocked for want of an output document", () => {
  const object = kerastase();
  // No `full_strategy` output record exists — the Director approval handoff
  // never ran, which is normal in the non-linear journey.
  assert.equal(object.meta.campaignOutputs?.full_strategy, undefined);

  const check = strategyCheck(object);
  assert.notEqual(check.state, "blocked", check.reason);
  assert.doesNotMatch(
    check.reason ?? "",
    /has not been generated/i,
    "the Strategy screen shows this strategy in full"
  );
});

test("a campaign with no Strategy at all is still blocked", () => {
  // The section is empty AND no strategy document exists — nothing to show.
  const object = kerastase({ strategyContent: "" });
  object.sections.strategy.status = "pending";
  const check = strategyCheck(object);
  assert.equal(check.state, "blocked");
  assert.match(check.reason ?? "", /has not been generated/i);
});

test("existence is the Strategy section, not the output document", () => {
  // `deriveInfluencerStrategyView` projects Campaign Facts, so it can never
  // report a missing strategy — the section the Strategy screen renders is the
  // signal, with the output document as the alternative.
  const object = kerastase();
  assert.equal(object.sections.strategy.status, "complete");
  assert.notEqual(strategyCheck(object).state, "blocked");

  const emptySection = kerastase({ strategyContent: "" });
  emptySection.sections.strategy.status = "pending";
  assert.equal(strategyCheck(emptySection).state, "blocked");
});

// ---------------------------------------------------------------------------
// 2. Discovery: an enrichment gap is not a missing campaign fact.

test("a creator's missing enrichment field never reads as a missing campaign fact", () => {
  const object = kerastase({ missingCreatorData: ["Geography"] });
  const sufficiency = resolveStudioDiscoverySufficiency(object, false);

  assert.equal(sufficiency.state, "enrichment_required");
  // Egypt is confirmed in Campaign Facts and named in the Strategy.
  assert.deepEqual(object.meta.campaignFacts?.geography, ["Egypt"]);
  assert.match(sufficiency.detail, /enrichment records of creators/i);
  assert.match(sufficiency.detail, /not from the campaign's confirmed facts/i);
  assert.doesNotMatch(
    sufficiency.detail,
    /Geography is still missing/i,
    "this read as the campaign losing its market"
  );
});

// ---------------------------------------------------------------------------
// 3. Readiness: one status, everywhere.

test("Ready and Not ready can never be shown at the same time", () => {
  const object = kerastase();
  const readiness = resolveStudioPackageReadiness(object);
  const status = resolveStudioReadinessStatus({
    packageState: readiness.overall,
    completionPercent: 89,
  });

  assert.equal(status.ready, readiness.readyForClient || readiness.overall === "ready_for_internal_review");
  if (!status.ready) {
    assert.equal(status.label, "Not ready", status.summary);
    assert.doesNotMatch(status.summary, /^Ready/);
  }
});

test("an unready package reports its progress without claiming readiness", () => {
  const status = resolveStudioReadinessStatus({
    packageState: "blocked",
    completionPercent: 89,
  });
  assert.equal(status.summary, "Not ready · 89% complete");
  assert.equal(status.ready, false);
});

test("89% no longer means Ready", () => {
  // The mast used to label anything at or above 75% "Ready", from the
  // completion percentage alone.
  for (const percent of [75, 80, 89, 99]) {
    const status = resolveStudioReadinessStatus({ packageState: "in_progress", completionPercent: percent });
    assert.equal(status.ready, false, String(percent));
    assert.match(status.summary, /In progress/);
  }
});

test("a ready package reads Ready with its percentage", () => {
  for (const state of ["ready_for_client", "ready_for_internal_review"] as const) {
    const status = resolveStudioReadinessStatus({ packageState: state, completionPercent: 100 });
    assert.equal(status.ready, true);
    assert.equal(status.summary, "Ready · 100%");
  }
});

test("the nav's Package step cannot call itself ready on its own", () => {
  const object = kerastase();
  object.sections.presentation.status = "complete";
  const sections = Object.values(object.sections).map((section, index) => ({
    id: (["campaign-summary", "executive-strategy", "creator-recommendations", "content-plan", "budget-planner", "presentation-status"] as const)[index % 6],
    title: "",
    status: "complete" as const,
    content: "",
  }));

  const notReady = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections,
    outdatedSections: new Set(),
    packageReady: false,
  }).find((step) => step.id === "package")!;
  assert.notEqual(notReady.status, "ready");
  assert.equal(notReady.complete, false);

  const ready = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections,
    outdatedSections: new Set(),
    packageReady: true,
  }).find((step) => step.id === "package")!;
  assert.equal(ready.status, "ready");
});

test("without the readiness service the nav claims no readiness", () => {
  const object = kerastase();
  object.sections.presentation.status = "complete";
  const step = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections: [
      { id: "campaign-summary", title: "", status: "complete", content: "" },
      { id: "presentation-status", title: "", status: "complete", content: "" },
    ],
    outdatedSections: new Set(),
  }).find((item) => item.id === "package")!;
  assert.notEqual(step.status, "ready");
});

// ---------------------------------------------------------------------------
// 4. Intake: one interpretation of confirmed.

test("confirmed facts are not displayed as Pending", () => {
  const object = kerastase();
  assert.equal(resolveStudioIntakeDisplayStatus(object, "pending"), "complete");
  assert.equal(resolveStudioIntakeDisplayStatus(object, "complete"), "complete");
});

test("extraction still in flight stays in progress", () => {
  // The genuine asynchronous state, kept: a specialist is running.
  assert.equal(resolveStudioIntakeDisplayStatus(kerastase(), "running"), "running");
});

test("unconfirmed facts are not displayed as complete", () => {
  // The confirmation gate is unchanged — this only chooses which authority the
  // badge reads.
  const object = kerastase({ factsConfirmedAt: null });
  assert.notEqual(resolveStudioIntakeDisplayStatus(object, "pending"), "complete");
});

test("a campaign with no facts keeps the workflow's own status", () => {
  const object = createEmptyCampaignObject({
    id: "empty",
    conversationId: "conv-empty",
    workflowId: "create-campaign",
  });
  assert.equal(resolveStudioIntakeDisplayStatus(object, "pending"), "pending");
  assert.equal(resolveStudioIntakeDisplayStatus(undefined, "pending"), "pending");
});

test("the nav and the intake badge agree on the same campaign", () => {
  const object = kerastase();
  const intakeStep = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections: [{ id: "campaign-summary", title: "", status: "pending", content: "" }],
    outdatedSections: new Set(),
  }).find((step) => step.id === "intake")!;

  assert.equal(intakeStep.complete, true, "the nav reads the canonical confirmation");
  assert.equal(
    resolveStudioIntakeDisplayStatus(object, "pending"),
    "complete",
    "and so does the badge"
  );
});
