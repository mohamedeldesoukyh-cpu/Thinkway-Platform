import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runCampaignQaManager } from "./campaign-qa-manager";
import {
  buildGovernanceUserQuestions,
  shouldAskUserForGovernanceCheck,
} from "./governance-repair";
import type { GovernanceCheck, GovernanceValidationInput } from "./governance-types";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types/pipeline";

const sharedSentence =
  "Please run campaign intelligence planning package for NBK Egypt summer banking awareness with four Instagram creators";

function baseFacts(): CampaignFacts {
  return {
    brandName: "NBK",
    objective: "brand awareness",
    budget: { amount: 400_000, currency: "EGP" },
    durationWeeks: 6,
    geography: ["Egypt"],
    audience: "professionals 25-40",
    platforms: ["Instagram"],
    kpis: ["Reach"],
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
}

function baseStrategy(): CampaignStrategyDocument {
  return {
    id: "strat-stab-029",
    version: 1,
    createdAt: new Date().toISOString(),
    understanding: {
      brand: "NBK",
      client: "NBK",
      objective: "Drive brand awareness for NBK retail banking in Egypt.",
      audience: `${sharedSentence}. Focus on urban professionals 25-40.`,
      budget: { amount: 400_000, currency: "EGP", rationale: "Brief" },
      timeline: { durationWeeks: 6, rationale: "Brief" },
      platforms: ["Instagram"],
      kpis: [{ metric: "Reach", target: "2M", why: "Category benchmark" }],
      risks: ["Creator availability"],
      constraints: [],
    },
    narrative: `${sharedSentence}. Position NBK as the trusted everyday bank.`,
    pillars: [
      { title: "Trust", what: "Everyday banking credibility", why: "Category need" },
      { title: "Reach", what: "Instagram creator slate", why: "Platform fit" },
      { title: "Proof", what: "Product moments", why: "Conversion assist" },
    ],
    platformMix: [{ platform: "Instagram", role: "Primary", why: "Brief" }],
    creatorTierStrategy: [{ tier: "mid", allocationPercent: 100, why: "Efficient reach" }],
  };
}

function qaInput(): GovernanceValidationInput {
  return {
    briefText:
      "NBK Egypt summer campaign. Budget EGP 400000. 4 Instagram creators. 6 weeks.",
    facts: baseFacts(),
    strategy: baseStrategy(),
    specialistOutputs: [
      {
        specialistId: "strategy",
        domain: "strategy",
        status: "approved",
        revisionRound: 0,
        what: "Strategy summary for NBK awareness.",
        why: "Aligned to brief objective and budget constraints.",
        evidence: ["brief"],
        sections: ["strategy"],
      },
    ],
    budget: {
      total: 400_000,
      currency: "EGP",
      allocations: [{ category: "Creators", amount: 400_000, percent: 100 }],
    },
    timelineWeeks: 6,
  };
}

describe("STAB-029 duplicate facts governance", () => {
  it("treats cross-section repeated facts as WARNING, not FAIL", () => {
    const report = runCampaignQaManager(qaInput());
    const dups = report.checks.filter((c) => c.id === "qa_no_duplicate_facts");
    assert.ok(dups.length >= 1, "expected duplicate-fact check(s)");
    for (const dup of dups) {
      if (dup.status === "PASS") continue;
      assert.equal(dup.status, "WARNING", `expected WARNING, got ${dup.status}: ${dup.issue}`);
      assert.equal(dup.severity, "medium");
    }
    assert.equal(
      dups.filter((c) => c.status === "FAIL").length,
      0,
      "duplicate facts must never hard-FAIL"
    );
  });

  it("does not escalate medium polish checks to INPUT REQUIRED questions", () => {
    const polishFail: GovernanceCheck = {
      id: "qa_no_duplicate_facts",
      name: "No duplicated facts across sections",
      status: "FAIL",
      section: "narrative, audience",
      issue: `Repeated fact: "${sharedSentence.slice(0, 60)}..."`,
      severity: "medium",
      recommendation: "Each fact should appear once",
    };
    assert.equal(shouldAskUserForGovernanceCheck(polishFail), false);
    const questions = buildGovernanceUserQuestions([polishFail], [
      "Campaign QA Manager gate failed",
    ]);
    assert.equal(questions.length, 0, "polish residuals must not become user questions");
  });

  it("still asks for missing budget (user_required)", () => {
    const budgetFail: GovernanceCheck = {
      id: "qa_budget_present",
      name: "Budget present",
      status: "FAIL",
      severity: "high",
      issue: "Missing budget",
    };
    assert.equal(shouldAskUserForGovernanceCheck(budgetFail), true);
    const questions = buildGovernanceUserQuestions([budgetFail], []);
    assert.ok(questions.some((q) => /budget/i.test(q.question)));
  });
});
