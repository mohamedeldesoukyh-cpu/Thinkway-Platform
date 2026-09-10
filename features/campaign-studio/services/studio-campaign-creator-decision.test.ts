/**
 * ONE campaign decision per creator, and ECI is not it.
 *
 * `toCampaignDecisionLabel(signal.recommendation)` mapped the ECI INVESTMENT
 * verdict into a campaign decision and fed it to the recommendation gate, the
 * card's pill, the executive planning view, and the candidate label "Campaign
 * recommendation: not recommended". So a card inside the campaign
 * recommendation area could say it was not recommended for that campaign, with
 * "Overall score 40 with multiple high risks", "Commercial outlook weak" and
 * "Limited commercial data" printed beneath it.
 *
 * The campaign decision now comes from campaign requirements — the campaign's
 * market, its platforms, the brief's creator mix — plus the operator's own
 * decision. ECI rides along as supporting intelligence and cannot change the
 * status. No ECI calculation is touched.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import {
  campaignDecisionContradictsSupporting,
  campaignRequirementChecks,
  resolveCampaignCreatorDecision,
  type CampaignRequirementCheck,
} from "./studio-campaign-creator-decision";
import {
  INTERNAL_TERMINOLOGY,
  containsInternalTerminology,
} from "./studio-creator-client-decision";

const FACTS = {
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
  brandName: "Kerastase",
  objective: "Brand awareness",
  geography: ["Egypt"],
  platforms: ["Instagram", "TikTok"],
} as CampaignFacts;

const IN_MARKET = {
  country: "Egypt",
  platform: "instagram",
  audienceSummary: "Egyptian haircare and beauty audience",
  categories: ["Beauty"],
  handle: "@cairo.hair",
  displayName: "Cairo Hair",
};

/** The exact ECI lines the screenshots showed on client-facing cards. */
const LEAKED = [
  "Mixed investment signals across the commercial layers.",
  "Overall score 40 with multiple high risks.",
  "Commercial outlook weak for the campaign window.",
  "Limited campaign history for this creator.",
  "Limited commercial data available.",
  "Pricing volatility across recent quotations.",
  "Enterprise Creator Intelligence does not support selection.",
  "Evidence coverage 35% across the investment layers.",
  "Confidence: 40%",
  "Investment readiness is not established.",
];

function signal(overrides: Partial<StudioEciPlanningSignal> = {}): StudioEciPlanningSignal {
  return {
    influencerId: "inf:c1",
    platform: "instagram",
    investmentScore: 40,
    recommendation: "Not Recommended",
    why: LEAKED[1]!,
    whyNot: LEAKED[2]!,
    businessObjectiveSupport: "Reaches an Egyptian beauty audience on Instagram.",
    commercialJustification: LEAKED[5]!,
    commercialHealth: "Weak",
    businessReadiness: "Not ready",
    evidence: [],
    topStrengths: ["Strong beauty category specialisation."],
    risks: [LEAKED[3]!, LEAKED[4]!],
    alternatives: [],
    expectedOutcomes: [],
    confidencePercent: 40,
    evidenceCoveragePercent: 35,
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
    expectedCampaignContribution: "Adds category-aligned reach.",
    ...overrides,
  };
}

const met = (label: string): CampaignRequirementCheck => ({ label, met: true });
const unmet = (label: string): CampaignRequirementCheck => ({ label, met: false });
const unstated = (label: string): CampaignRequirementCheck => ({ label, met: null });

// ---------------------------------------------------------------------------
// ECI is not the campaign decision.

test("a negative investment verdict does not make a fitting creator not recommended", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [met("Market"), met("Platform"), met("Creator mix")],
    supportingSignal: signal(),
  });
  assert.equal(decision.status, "recommended");
  assert.equal(decision.label, "Recommended for this campaign");
});

test("a positive investment verdict does not rescue a creator outside the market", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [unmet("Market"), met("Platform"), met("Creator mix")],
    supportingSignal: signal({ recommendation: "Recommended", investmentScore: 92 }),
  });
  assert.equal(decision.status, "not_recommended");
  assert.match(decision.why, /market/i);
});

test("investment intelligence appears only as support, and never as the decision", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [met("Market"), met("Platform"), met("Creator mix")],
    supportingSignal: signal(),
  });
  const decisionText = [decision.label, decision.why, ...decision.evidence].join(" ");
  for (const pattern of INTERNAL_TERMINOLOGY) {
    assert.equal(pattern.test(decisionText), false, `${pattern} reached the decision`);
  }
  assert.equal(campaignDecisionContradictsSupporting(decision), false);
});

test("every leaked line from the screenshots is recognised as internal", () => {
  for (const line of LEAKED) {
    assert.equal(containsInternalTerminology(line), true, line);
  }
});

test("no leaked line survives into any part of a card's decision", () => {
  const leaky = signal({
    topStrengths: [LEAKED[0]!, LEAKED[9]!],
    businessObjectiveSupport: LEAKED[6]!,
  });
  for (const onSlate of [true, false]) {
    for (const requirements of [
      [met("Market"), met("Platform"), met("Creator mix")],
      [unmet("Market")],
      [unstated("Market"), unstated("Platform"), unstated("Creator mix")],
    ]) {
      const decision = resolveCampaignCreatorDecision({
        onSlate,
        requirements,
        supportingSignal: leaky,
      });
      assert.equal(
        campaignDecisionContradictsSupporting(decision),
        false,
        JSON.stringify(decision)
      );
    }
  }
});

test("ordinary business language is not mistaken for internal terminology", () => {
  for (const line of [
    "Reaches an Egyptian beauty audience on Instagram.",
    "Strong beauty category specialisation.",
    "Meets 3 of 3 stated campaign requirements.",
    "Market: met.",
  ]) {
    assert.equal(containsInternalTerminology(line), false, line);
  }
});

// ---------------------------------------------------------------------------
// Missing intelligence is never a rejection.

test("a campaign that states no requirements gets a neutral review state", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: false,
    requirements: [unstated("Market"), unstated("Platform"), unstated("Creator mix")],
  });
  assert.equal(decision.status, "needs_review");
  assert.equal(decision.label, "Needs review");
  assert.doesNotMatch(decision.label, /not recommended/i);
});

test("no ECI signal at all is not a rejection", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [met("Market"), met("Platform"), met("Creator mix")],
    supportingSignal: null,
  });
  assert.equal(decision.status, "recommended");
  assert.deepEqual(decision.supporting, []);
});

test("an unstated requirement neither passes nor fails", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: false,
    requirements: [met("Market"), unstated("Platform"), unstated("Creator mix")],
  });
  // One stated requirement, met: nothing failed, so this is not a rejection.
  assert.notEqual(decision.status, "not_recommended");
});

test("a creator off the slate with unverifiable requirements is reviewed, not rejected", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: false,
    requirements: [met("Market"), { label: "Creator mix", met: null }, unstated("Platform")],
  });
  assert.notEqual(decision.status, "not_recommended");
});

// ---------------------------------------------------------------------------
// One object: status, label, why and evidence agree.

test("the label always matches the status", () => {
  const cases: Array<[CampaignRequirementCheck[], string]> = [
    [[met("Market"), met("Platform")], "Recommended for this campaign"],
    [[unmet("Market")], "Not recommended for this campaign"],
    [[unstated("Market")], "Needs review"],
  ];
  for (const [requirements, label] of cases) {
    const decision = resolveCampaignCreatorDecision({ onSlate: true, requirements });
    assert.equal(decision.label, label, JSON.stringify(requirements));
  }
});

test("a recommendation's evidence supports the recommendation", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [met("Market"), met("Platform"), met("Creator mix")],
    slateRationale: "Egyptian haircare audience with salon-result content.",
  });
  assert.equal(decision.status, "recommended");
  assert.equal(decision.evidence[0], "Egyptian haircare audience with salon-result content.");
  assert.ok(decision.evidence.some((line) => /Meets 3 of 3/.test(line)));
  assert.ok(!decision.evidence.some((line) => /not met/i.test(line)));
});

test("a rejection's evidence names the requirement that failed", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [unmet("Market"), met("Platform")],
    slateRationale: "Was placed on the slate for reach.",
  });
  assert.equal(decision.status, "not_recommended");
  assert.equal(decision.evidence[0], "Market: not met for this campaign.");
});

test("the operator's own decision outranks every derivation", () => {
  const rejected = resolveCampaignCreatorDecision({
    onSlate: true,
    operatorStatus: "rejected",
    requirements: [met("Market"), met("Platform"), met("Creator mix")],
    supportingSignal: signal({ recommendation: "Recommended" }),
  });
  assert.equal(rejected.status, "not_recommended");
  assert.match(rejected.why, /team/i);

  const approved = resolveCampaignCreatorDecision({
    onSlate: true,
    operatorStatus: "approved",
    requirements: [unmet("Market")],
    supportingSignal: signal(),
  });
  assert.equal(approved.status, "recommended");
});

// ---------------------------------------------------------------------------
// The checks come from campaign facts, and Platform Score is not among them.

test("requirements are read from the campaign's own facts", () => {
  const checks = campaignRequirementChecks(IN_MARKET, FACTS);
  const byLabel = new Map(checks.map((row) => [row.label, row.met]));
  assert.equal(byLabel.get("Market"), true);
  assert.equal(byLabel.get("Platform"), true);
  assert.notEqual(byLabel.get("Creator mix"), false);
});

test("a requirement the campaign never stated is null, not false", () => {
  const checks = campaignRequirementChecks(IN_MARKET, {
    ...FACTS,
    geography: [],
    platforms: [],
  } as CampaignFacts);
  const byLabel = new Map(checks.map((row) => [row.label, row.met]));
  assert.equal(byLabel.get("Market"), null, "an unstated market cannot reject a creator");
  assert.equal(byLabel.get("Platform"), null);
});

test("an out-of-market creator fails the market requirement", () => {
  const checks = campaignRequirementChecks({ ...IN_MARKET, country: "France" }, FACTS);
  assert.equal(checks.find((row) => row.label === "Market")?.met, false);
});

test("no requirement is a Discovery platform score", () => {
  const labels = campaignRequirementChecks(IN_MARKET, FACTS).map((row) => row.label);
  // Platform here is the campaign's platform list — an eligibility requirement.
  // The Discovery Platform Score stays out of selection and ordering entirely.
  for (const label of labels) {
    assert.doesNotMatch(label, /score/i, label);
  }
  assert.deepEqual(labels, ["Market", "Platform", "Creator mix"]);
});

test("a creator with no platform recorded is not failed for it", () => {
  const checks = campaignRequirementChecks({ ...IN_MARKET, platform: undefined }, FACTS);
  assert.equal(checks.find((row) => row.label === "Platform")?.met, null);
});
