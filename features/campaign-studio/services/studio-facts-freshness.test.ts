import assert from "node:assert/strict";
import { test } from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  confirmCampaignIntelligenceProfile,
  projectConfirmedCampaignFacts,
} from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import {
  generateCampaignOutput,
  getCampaignOutput,
  listCampaignOutputs,
  regenerateStaleCampaignOutputs,
} from "@/features/campaign-outputs/output-registry";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { applyTimelineChange } from "./copilot/campaign-facts-mutations";
import {
  FACTS_FRESHNESS_STUDIO_SECTIONS,
  outdatedStudioSections,
  outdatedStudioSectionsFromOutputs,
  studioFreshnessSummary,
} from "./studio-facts-freshness";

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
  "executive_proposal",
  "content_calendar",
] as const;

function arabBankObjectAtConfirmedFacts() {
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
  assert.equal(facts!.durationWeeks, 4);

  return buildCampaignObjectFixture({
    facts: {
      clientName: "Arab Bank",
      brandName: "Arab Bank",
      objective: facts!.objective,
      audience: facts!.audience,
      geography: facts!.geography,
      platforms: facts!.platforms?.length ? facts!.platforms : ["Instagram", "TikTok"],
      budget: facts!.budget,
      durationWeeks: facts!.durationWeeks,
    },
  });
}

function generatePlanningPackage(campaignObject: ReturnType<typeof arabBankObjectAtConfirmedFacts>) {
  let next = campaignObject;
  for (const kind of GENERATED_KINDS) {
    ({ campaignObject: next } = generateCampaignOutput(next, kind));
  }
  return next;
}

test("duration 4→6 marks generated package outputs needs_update, not CURRENT", () => {
  const generated = generatePlanningPackage(arabBankObjectAtConfirmedFacts());
  for (const kind of GENERATED_KINDS) {
    assert.equal(getCampaignOutput(generated, kind)?.status, "generated");
  }

  const strategyAtFour = getCampaignOutput(generated, "full_strategy")?.content;
  assert.match(JSON.stringify(strategyAtFour), /4-week|Total duration: 4 weeks/);

  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  assert.equal(getCampaignFacts(stale)?.durationWeeks, 6);

  for (const kind of GENERATED_KINDS) {
    const record = stale.meta.campaignOutputs?.[kind];
    assert.equal(record?.status, "needs_update", `${kind} stored status must flip off generated`);
    assert.equal(getCampaignOutput(stale, kind)?.status, "needs_update");
    const view = listCampaignOutputs(stale).find((item) => item.kind === kind);
    assert.equal(view?.status, "needs_update");
    assert.equal(view?.staleReason, "Timeline changed.");
  }
});

test("duration 4→6 marks Strategy, Discovery, Mix, Content, Commercial, Timeline, Proposal, Presentation Outdated", () => {
  const generated = generatePlanningPackage(arabBankObjectAtConfirmedFacts());
  assert.equal(outdatedStudioSectionsFromOutputs(generated).size, 0);

  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  const outdated = outdatedStudioSections(stale, EMPTY_DRAFT);

  for (const sectionId of FACTS_FRESHNESS_STUDIO_SECTIONS) {
    assert.ok(outdated.has(sectionId), `${sectionId} must be Outdated after duration change`);
  }

  const freshness = studioFreshnessSummary(stale, outdated);
  assert.equal(freshness.showBanner, true);
  assert.ok(freshness.staleOutputCount >= GENERATED_KINDS.length);
  assert.match(freshness.cause, /timeline changed/i);
});

test("regenerating stale outputs after 1 month → 6 weeks is CURRENT at 6 weeks, never 1 month", () => {
  const generated = generatePlanningPackage(arabBankObjectAtConfirmedFacts());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });

  const refreshed = regenerateStaleCampaignOutputs(stale);
  assert.equal(getCampaignFacts(refreshed)?.durationWeeks, 6);

  for (const kind of GENERATED_KINDS) {
    assert.equal(getCampaignOutput(refreshed, kind)?.status, "generated", `${kind} must be current`);
    const view = listCampaignOutputs(refreshed).find((item) => item.kind === kind);
    assert.equal(view?.status, "generated");
    assert.equal(view?.staleReason, undefined);
  }

  const strategy = JSON.stringify(getCampaignOutput(refreshed, "full_strategy")?.content);
  assert.match(strategy, /6-week|Total duration: 6 weeks/);
  assert.doesNotMatch(strategy, /4-week|Total duration: 4 weeks|1 month/);

  const proposal = JSON.stringify(getCampaignOutput(refreshed, "executive_proposal")?.content);
  assert.match(proposal, /6 weeks|6-week/);
  assert.doesNotMatch(proposal, /4 weeks|4-week|1 month/);

  const calendar = getCampaignOutput(refreshed, "content_calendar")?.content?.data as
    | { durationWeeks?: number }
    | undefined;
  assert.equal(calendar?.durationWeeks, 6);

  assert.equal(outdatedStudioSections(refreshed, EMPTY_DRAFT).size, 0);
  assert.equal(studioFreshnessSummary(refreshed, new Set()).showBanner, false);
});

test("draft outdated still unions with facts freshness", () => {
  const generated = generatePlanningPackage(arabBankObjectAtConfirmedFacts());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  const outdated = outdatedStudioSections(stale, {
    changes: [
      {
        kind: "refresh_intelligence",
        creatorId: "cr_star",
        stagedAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  });
  assert.ok(outdated.has("kpi-forecast"));
  assert.ok(outdated.has("timeline"));
  assert.ok(outdated.has("creator-discovery"));
});
