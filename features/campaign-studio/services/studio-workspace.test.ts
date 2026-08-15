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
  regenerateStaleCampaignOutputs,
} from "@/features/campaign-outputs/output-registry";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

import { applyBudgetChange, applyTimelineChange } from "./copilot/campaign-facts-mutations";
import { outdatedStudioSections, studioFreshnessSummary } from "./studio-facts-freshness";
import {
  applyIntakeFactsEdit,
  campaignFactsFromIntakeEdit,
  confirmStudioIntakeOnCampaignObject,
  mergeIntakeDisplayFacts,
  requiredIntakeFacts,
  shouldShowIntakeClarification,
} from "./studio-intake-facts";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";
import {
  defaultStudioWorkspaceStep,
  isStudioIntakeConfirmed,
  outdatedWorkspaceSteps,
  resolveStudioWorkspaceSteps,
} from "./studio-workspace-status";

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

function arabBankObject() {
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

  const object = buildCampaignObjectFixture({
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

  return confirmStudioIntakeOnCampaignObject(object, facts!);
}

function generatePlanningPackage(campaignObject: ReturnType<typeof arabBankObject>) {
  let next = campaignObject;
  for (const kind of GENERATED_KINDS) {
    ({ campaignObject: next } = generateCampaignOutput(next, kind));
  }
  return next;
}

const COMPLETE_SECTIONS = [
  "campaign-summary",
  "executive-strategy",
  "creator-discovery",
  "creator-recommendations",
  "content-plan",
  "budget-planner",
  "timeline",
  "presentation-status",
].map((id) => ({
  id: id as never,
  title: id,
  status: "complete" as const,
  content: "",
  taskIds: [],
}));

test("Intake shows Arab Bank facts without inventing duration", () => {
  const object = arabBankObject();
  const facts = getCampaignFacts(object);
  assert.equal(facts?.durationWeeks, 4);
  assert.equal(facts?.budget?.amount, 5_000_000);
  assert.equal(facts?.budget?.currency, "EGP");

  const intake = requiredIntakeFacts(facts);
  assert.equal(intake.canConfirm, true);
  assert.equal(intake.missing.length, 0);
  assert.equal(intake.rows.find((row) => row.key === "client")?.value, "Arab Bank");
  assert.equal(intake.rows.find((row) => row.key === "campaign")?.value, "Credit Card Instant Issuance");
  assert.equal(intake.rows.find((row) => row.key === "country")?.value, "Egypt");
  assert.equal(intake.rows.find((row) => row.key === "budget")?.value, "EGP 5,000,000");
  assert.equal(intake.rows.find((row) => row.key === "duration")?.value, "1 month / 4 weeks");
  assert.match(intake.rows.find((row) => row.key === "objective")?.value ?? "", /awareness/i);
});

test("Intake missing required facts stay Missing and cannot confirm", () => {
  const intake = requiredIntakeFacts({
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    clientName: "Arab Bank",
    geography: ["Egypt"],
  });
  assert.equal(intake.canConfirm, false);
  const missingKeys = intake.missing.map((row) => row.key);
  assert.ok(missingKeys.includes("budget"));
  assert.ok(missingKeys.includes("duration"));
  assert.ok(missingKeys.includes("objective"));
  assert.equal(intake.rows.find((row) => row.key === "budget")?.state, "missing");
  assert.equal(intake.rows.find((row) => row.key === "country")?.state, "confirmed");
});

test("left rail keeps later steps Blocked until Intake is confirmed, even if Discovery is running", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      clientName: "Arab Bank",
      brandName: "Arab Bank",
    },
  });
  const runningDiscovery = COMPLETE_SECTIONS.map((section) => ({
    ...section,
    status: section.id === "creator-discovery" ? ("running" as const) : ("pending" as const),
  }));
  const steps = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections: runningDiscovery,
    outdatedSections: new Set(),
  });
  assert.equal(steps.find((step) => step.id === "intake")?.status, "in_progress");
  assert.equal(steps.find((step) => step.id === "strategy")?.status, "blocked");
  assert.equal(steps.find((step) => step.id === "creators")?.status, "blocked");
  assert.equal(steps.find((step) => step.id === "content")?.status, "blocked");
  assert.equal(steps.find((step) => step.id === "commercial")?.status, "blocked");
  assert.equal(steps.find((step) => step.id === "package")?.status, "blocked");
  assert.equal(defaultStudioWorkspaceStep(steps), "intake");
});

test("left rail stays Blocked after required facts are filled until Confirm campaign", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      clientName: "Arab Bank",
      brandName: "Arab Bank",
      product: "Credit Card Instant Issuance",
      objective: "Awareness and acquisition",
      geography: ["Egypt"],
      budget: { amount: 3_000_000, currency: "EGP" },
      durationWeeks: 4,
    },
  });
  object.meta.status = "paused";
  assert.equal(isStudioIntakeConfirmed(object), false);
  assert.equal(requiredIntakeFacts(getCampaignFacts(object)).canConfirm, true);

  const steps = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections: COMPLETE_SECTIONS,
    outdatedSections: new Set(),
  });
  assert.equal(steps.find((step) => step.id === "intake")?.status, "in_progress");
  assert.equal(steps.find((step) => step.id === "strategy")?.status, "blocked");
  assert.equal(steps.find((step) => step.id === "creators")?.status, "blocked");
});

test("stale budget INPUT REQUIRED hides once budget is on Campaign Facts", () => {
  const question =
    "To finalize your campaign, I need one more detail: What is the total campaign budget (amount and currency)?";
  assert.equal(
    shouldShowIntakeClarification(question, {
      extractedAt: new Date().toISOString(),
      confidence: {},
      sources: {},
      budget: { amount: 3_000_000, currency: "EGP" },
    }),
    false
  );
  assert.equal(
    shouldShowIntakeClarification(question, {
      extractedAt: new Date().toISOString(),
      confidence: {},
      sources: {},
    }),
    true
  );
});

test("Confirm campaign clears the stale copilot budget question", () => {
  const object = buildCampaignObjectFixture();
  object.meta.clarificationQuestion =
    "What is the total campaign budget (amount and currency)?";
  const confirmed = confirmStudioIntakeOnCampaignObject(object, getCampaignFacts(object)!);
  assert.equal(confirmed.meta.clarificationQuestion, undefined);
  assert.ok(confirmed.meta.factsConfirmedAt);
});

test("workspace steps map engines to Intake → Package without KPI cards", () => {
  const object = arabBankObject();
  const steps = resolveStudioWorkspaceSteps({
    campaignObject: object,
    sections: COMPLETE_SECTIONS,
    outdatedSections: new Set(),
  });
  assert.deepEqual(
    steps.map((step) => step.id),
    ["intake", "strategy", "creators", "content", "commercial", "package"]
  );
  assert.equal(steps[0]?.status, "current");
  assert.equal(defaultStudioWorkspaceStep(steps), "intake");
});

test("duration 1 month → 6 weeks marks dependent steps Outdated, Intake stays Current", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  assert.equal(getCampaignFacts(stale)?.durationWeeks, 6);

  const outdatedSections = outdatedStudioSections(stale, EMPTY_DRAFT);
  const outdatedSteps = outdatedWorkspaceSteps(outdatedSections);
  assert.ok(!outdatedSteps.has("intake"));
  assert.ok(outdatedSteps.has("strategy"));
  assert.ok(outdatedSteps.has("creators"));
  assert.ok(outdatedSteps.has("content"));
  assert.ok(outdatedSteps.has("commercial"));
  assert.ok(outdatedSteps.has("package"));

  const steps = resolveStudioWorkspaceSteps({
    campaignObject: stale,
    sections: COMPLETE_SECTIONS,
    outdatedSections,
  });
  assert.equal(steps.find((step) => step.id === "intake")?.status, "current");
  assert.equal(steps.find((step) => step.id === "strategy")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "creators")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "content")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "commercial")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "package")?.status, "outdated");

  const freshness = studioFreshnessSummary(stale, outdatedSections);
  assert.equal(freshness.showBanner, true);
});

test("budget EGP 5M → 3M marks Strategy/Creators/Content/Commercial/Package Outdated", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyBudgetChange(generated, {
    amount: 3_000_000,
    currency: "EGP",
  });
  assert.equal(getCampaignFacts(stale)?.budget?.amount, 3_000_000);

  const outdatedSections = outdatedStudioSections(stale, EMPTY_DRAFT);
  const outdatedSteps = outdatedWorkspaceSteps(outdatedSections);
  assert.ok(!outdatedSteps.has("intake"));
  assert.ok(outdatedSteps.has("strategy"));
  assert.ok(outdatedSteps.has("creators"));
  assert.ok(outdatedSteps.has("content"));
  assert.ok(outdatedSteps.has("commercial"));
  assert.ok(outdatedSteps.has("package"));

  const steps = resolveStudioWorkspaceSteps({
    campaignObject: stale,
    sections: COMPLETE_SECTIONS,
    outdatedSections,
  });
  assert.equal(steps.find((step) => step.id === "intake")?.status, "current");
  assert.equal(steps.find((step) => step.id === "strategy")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "commercial")?.status, "outdated");
  assert.equal(steps.find((step) => step.id === "package")?.status, "outdated");
});

test("regenerating after 6 weeks restores Current at 6 weeks, never 1 month", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const { campaignObject: stale } = applyTimelineChange(generated, { durationWeeks: 6 });
  const refreshed = regenerateStaleCampaignOutputs(stale);
  assert.equal(getCampaignFacts(refreshed)?.durationWeeks, 6);

  const outdatedSections = outdatedStudioSections(refreshed, EMPTY_DRAFT);
  assert.equal(outdatedSections.size, 0);

  const intake = requiredIntakeFacts(getCampaignFacts(refreshed));
  assert.equal(intake.rows.find((row) => row.key === "duration")?.value, "6 weeks");
  assert.notEqual(intake.rows.find((row) => row.key === "duration")?.value, "1 month / 4 weeks");

  const steps = resolveStudioWorkspaceSteps({
    campaignObject: refreshed,
    sections: COMPLETE_SECTIONS,
    outdatedSections,
  });
  assert.ok(steps.every((step) => step.status !== "outdated"));
});

test("Package readiness is a compact checkpoint, not a diagnostic dump", () => {
  const generated = generatePlanningPackage(arabBankObject());
  const ready = resolveStudioPackageReadiness(generated, new Set());
  assert.ok(ready.checks.length <= 9);
  assert.ok(ready.checks.some((check) => check.id === "intake"));
  assert.ok(ready.checks.some((check) => check.id === "timeline"));
  assert.ok(!ready.checks.some((check) => /apify|fingerprint|eci/i.test(check.label)));

  const { campaignObject: stale } = applyBudgetChange(generated, {
    amount: 3_000_000,
    currency: "EGP",
  });
  const outdated = outdatedStudioSections(stale, EMPTY_DRAFT);
  const packageView = resolveStudioPackageReadiness(stale, outdated);
  assert.ok(packageView.attentionCount >= 1);
  assert.equal(packageView.readyForClient, false);
  assert.equal(packageView.canCreateClientReview, false);
  assert.match(packageView.headline, /not ready|need attention/i);
  assert.match(packageView.attentionSummary ?? packageView.headline, /need attention/i);
});

test("Intake fact edits write Campaign Facts SSOT and do not invent duration", () => {
  const object = arabBankObject();
  const next = applyIntakeFactsEdit(object, {
    durationWeeks: 6,
    budgetAmount: 3_000_000,
    budgetCurrency: "EGP",
  });
  assert.equal(getCampaignFacts(next)?.durationWeeks, 6);
  assert.equal(getCampaignFacts(next)?.budget?.amount, 3_000_000);
  assert.equal(getCampaignFacts(object)?.durationWeeks, 4);
});

test("CIP brand/platforms appear in What Thinkway understood before Confirm", () => {
  const cipFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    brandName: "Arab Bank",
    clientName: "Arab Bank",
    platforms: ["instagram", "tiktok"],
  };
  const merged = mergeIntakeDisplayFacts(undefined, cipFacts);
  const intake = requiredIntakeFacts(merged);
  assert.equal(intake.rows.find((row) => row.key === "brand")?.state, "confirmed");
  assert.equal(intake.rows.find((row) => row.key === "platforms")?.state, "confirmed");
  assert.equal(intake.rows.find((row) => row.key === "budget")?.state, "missing");
  assert.equal(intake.canConfirm, false);
});

test("typing missing required facts in Intake enables Confirm without inventing budget", () => {
  const cipFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    brandName: "Arab Bank",
    clientName: "Arab Bank",
    objective: "Open Arab Bank accounts from Dubai",
    geography: ["United Arab Emirates", "Egypt"],
  };
  const live = campaignFactsFromIntakeEdit(
    {
      product: "Cross-border account opening",
      budgetAmount: 5_000_000,
      budgetCurrency: "EGP",
      durationWeeks: 8,
    },
    cipFacts
  );
  const intake = requiredIntakeFacts(mergeIntakeDisplayFacts(cipFacts, live));
  assert.equal(intake.canConfirm, true);
  assert.equal(intake.rows.find((row) => row.key === "budget")?.value, "EGP 5,000,000");
});
