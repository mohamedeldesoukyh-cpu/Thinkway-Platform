import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import type { CreatorActivationTimeline } from "@/features/campaign-intelligence/types/section-schemas";
import { applyTimelineChange } from "@/features/campaign-studio/services/copilot/campaign-facts-mutations";
import { resolveTimelineData } from "@/features/campaign-studio/services/section-data-resolver";
import { parseOptionalDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";
import {
  generateCampaignOutput,
  getCampaignOutput,
} from "@/features/campaign-outputs/output-registry";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

import {
  applyConfirmedCampaignFactsToCampaignObject,
  confirmCampaignIntelligenceProfile,
  isCampaignIntelligenceConfirmed,
  projectConfirmedCampaignFacts,
  unconfirmCampaignIntelligenceProfile,
} from "./campaign-facts-spine";
import { profileToCampaignFacts } from "./profile-to-facts";
import {
  createEmptyCampaignIntelligenceProfile,
  type CampaignIntelligenceProfile,
} from "../types/profile";

const ARAB_BANK_BRIEF = [
  "Client: Arab Bank.",
  "Brand: Arab Bank.",
  "Product: Credit Card Instant Issuance.",
  "Market: Egypt.",
  "Budget: EGP 5,000,000.",
  "Duration: 1 month.",
  "Objective: Awareness and acquisition.",
].join(" ");

function arabBankProfile(overrides: Partial<CampaignIntelligenceProfile> = {}): CampaignIntelligenceProfile {
  const extracted = extractCampaignFacts({ rawMessage: ARAB_BANK_BRIEF });
  return {
    ...createEmptyCampaignIntelligenceProfile(),
    ...extracted,
    schemaVersion: 1,
    status: "saved",
    campaignName: "Credit Card Instant Issuance",
    market: "Egypt",
    products: ["Credit Card Instant Issuance"],
    objectives: ["Awareness", "acquisition"],
    ...overrides,
  };
}

function staleActivation(durationWeeks: number): CreatorActivationTimeline {
  return {
    durationWeeks,
    activationWeeks: Array.from({ length: durationWeeks }, (_, index) => ({
      week: index + 1,
      tier: "Macro",
      objective: `Week ${index + 1} activation`,
      reason: "Stored activation",
      evidence: "stale timeline",
      tradeoff: "none",
      confidence: 0.5,
    })),
    reportingPhase: {
      label: "Reporting",
      reason: "Post-campaign report",
      evidence: "stale timeline",
    },
  };
}

function objectWithStaleActivation(facts: CampaignFacts, activationWeeks: number): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "arab-bank-campaign",
    conversationId: "conv-arab-bank",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.sections.timeline = {
    content: {
      durationWeeks: activationWeeks,
      milestones: [],
      goLiveWeek: Math.max(1, activationWeeks - 1),
    },
    data: { creatorActivationTimeline: staleActivation(activationWeeks) },
    status: "complete",
  };
  return applyConfirmedCampaignFactsToCampaignObject(object, facts);
}

test("1 month parses as 4 weeks, never the 6-week default", () => {
  assert.equal(parseOptionalDurationWeeks("Duration: 1 month"), 4);
  assert.equal(parseOptionalDurationWeeks(ARAB_BANK_BRIEF), 4);
  assert.equal(parseOptionalDurationWeeks("Campaign length 6 weeks"), 6);
  assert.equal(parseOptionalDurationWeeks("No duration stated"), undefined);

  const extracted = extractCampaignFacts({ rawMessage: ARAB_BANK_BRIEF });
  assert.equal(extracted.durationWeeks, 4);
  assert.notEqual(extracted.durationWeeks, 6);

  const missing = extractCampaignFacts({
    rawMessage: "Create a campaign for Arab Bank in Egypt. Budget: EGP 5,000,000.",
  });
  assert.equal(missing.durationWeeks, undefined);
  assert.equal(validateCampaignFacts(missing).durationWeeks, undefined);
});

test("unconfirmed CIP does not become Campaign Facts SSOT", () => {
  const profile = arabBankProfile();
  assert.equal(isCampaignIntelligenceConfirmed(profile), false);
  assert.equal(projectConfirmedCampaignFacts(profile), null);
  assert.equal(profileToCampaignFacts(profile).durationWeeks, 4);
});

test("confirm projects CIP as Campaign Facts SSOT with 4-week duration", () => {
  const confirmed = confirmCampaignIntelligenceProfile(arabBankProfile());
  assert.equal(isCampaignIntelligenceConfirmed(confirmed), true);
  const facts = projectConfirmedCampaignFacts(confirmed);
  assert.ok(facts);
  assert.equal(facts!.durationWeeks, 4);
  assert.match(facts!.brandName ?? "", /Arab Bank/i);
  assert.deepEqual(facts!.budget, { amount: 5_000_000, currency: "EGP" });
});

test("save/unconfirm clears confirmation so facts must be confirmed again", () => {
  const confirmed = confirmCampaignIntelligenceProfile(arabBankProfile());
  const saved = unconfirmCampaignIntelligenceProfile(confirmed);
  assert.equal(isCampaignIntelligenceConfirmed(saved), false);
  assert.equal(projectConfirmedCampaignFacts(saved), null);
});

test("1-month confirm then 6-week change rebuilds timeline from facts, not stale 4-week activation", () => {
  const confirmed = confirmCampaignIntelligenceProfile(arabBankProfile());
  const facts = projectConfirmedCampaignFacts(confirmed)!;
  assert.equal(facts.durationWeeks, 4);

  const withFacts = objectWithStaleActivation(facts, 4);
  assert.equal(getCampaignFacts(withFacts)?.durationWeeks, 4);

  const afterChange = applyTimelineChange(withFacts, { durationWeeks: 6 });
  assert.equal(getCampaignFacts(afterChange.campaignObject)?.durationWeeks, 6);
  assert.match(afterChange.change ?? "", /6 weeks/);

  const extras = afterChange.campaignObject.sections.timeline.data as {
    creatorActivationTimeline?: CreatorActivationTimeline;
  };
  assert.equal(extras.creatorActivationTimeline, undefined);

  const resolved = resolveTimelineData(afterChange.campaignObject);
  assert.ok(resolved);
  assert.equal(resolved!.durationWeeks, 6);
  assert.equal(resolved!.weeks.length, 6);
});

test("legacy campaign objects with stored facts keep working without confirmedAt", () => {
  const object = createEmptyCampaignObject({
    id: "legacy",
    conversationId: "conv-legacy",
    workflowId: "create-campaign",
  });
  object.meta.campaignFacts = {
    brandName: "Arab Bank",
    durationWeeks: 4,
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  object.meta.status = "complete";
  object.sections.timeline = {
    content: { durationWeeks: 4, milestones: [] },
    data: { creatorActivationTimeline: staleActivation(4) },
    status: "complete",
  };

  const resolved = resolveTimelineData(object);
  assert.equal(resolved?.durationWeeks, 4);
  assert.ok((resolved?.weeks.length ?? 0) >= 4);
});

test("facts duration wins over a leftover shorter activation timeline", () => {
  const object = createEmptyCampaignObject({
    id: "stale-activation",
    conversationId: "conv-stale",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.meta.campaignFacts = {
    brandName: "Arab Bank",
    durationWeeks: 6,
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  object.sections.timeline = {
    content: { durationWeeks: 4, milestones: [] },
    data: { creatorActivationTimeline: staleActivation(4) },
    status: "complete",
  };

  const resolved = resolveTimelineData(object);
  assert.ok(resolved);
  assert.equal(resolved!.durationWeeks, 6);
  assert.equal(resolved!.weeks.length, 6);
});

test("missing duration is not invented as 6 weeks on the timeline", () => {
  const object = createEmptyCampaignObject({
    id: "no-duration",
    conversationId: "conv-none",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.meta.campaignFacts = {
    brandName: "Arab Bank",
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  object.sections.summary = {
    content: "Duration: 10 weeks",
    status: "complete",
    data: { summaryCards: { duration: "10 weeks" } },
  };
  object.sections.timeline = {
    content: { durationWeeks: 10, milestones: [] },
    data: { creatorActivationTimeline: staleActivation(10) },
    status: "complete",
  };

  const resolved = resolveTimelineData(object);
  assert.equal(resolved, null);
});

test("re-confirming facts after duration change marks generated strategy OUTDATED", () => {
  const confirmed = confirmCampaignIntelligenceProfile(arabBankProfile());
  const factsAtFour = projectConfirmedCampaignFacts(confirmed)!;
  assert.equal(factsAtFour.durationWeeks, 4);

  const generated = generateCampaignOutput(
    buildCampaignObjectFixture({ facts: factsAtFour }),
    "full_strategy"
  ).campaignObject;
  assert.equal(getCampaignOutput(generated, "full_strategy")?.status, "generated");

  const factsAtSix = { ...factsAtFour, durationWeeks: 6 };
  const next = applyConfirmedCampaignFactsToCampaignObject(generated, factsAtSix);
  assert.equal(getCampaignFacts(next)?.durationWeeks, 6);
  assert.equal(next.meta.campaignOutputs?.full_strategy?.status, "needs_update");
});
