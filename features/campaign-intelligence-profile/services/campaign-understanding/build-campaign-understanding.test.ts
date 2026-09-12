import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";
import { normalizeCampaignIntelligenceProfile } from "../normalize-profile";
import { confirmCampaignIntelligenceProfile, unconfirmCampaignIntelligenceProfile } from "../campaign-facts-spine";
import { buildCampaignUnderstanding } from "./build-campaign-understanding";
import { evaluateCampaignUnderstandingQualityGate } from "./quality-gate";
import { deriveUnderstandingCoverage, validateCampaignUnderstanding } from "./validation";

function profile() {
  return {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "Example Bank",
    market: "Egypt",
    objective: "Awareness",
    platforms: ["Instagram"],
  };
}

test("real structured document blocks become evidence-backed understanding with unknown-safe coverage", () => {
  const understanding = buildCampaignUnderstanding({
    profile: profile(),
    sourceDocuments: [{
      id: "brief-doc",
      kind: "brief",
      document: {
        sections: [{
          title: "Campaign brief",
          blocks: [
            { type: "paragraph", text: "Example Bank launches an Awareness campaign in Egypt on Instagram." },
            { type: "paragraph", text: "Apply the client's proprietary resonance protocol." },
          ],
        }],
      },
    }],
  });
  assert.equal(understanding.sourceDocuments[0].id, "brief-doc");
  assert.ok(understanding.facts.some((fact) => fact.concept === "brand" && fact.evidence[0]?.sourceDocumentId === "brief-doc"));
  assert.ok(understanding.facts.some((fact) => fact.concept.startsWith("unclassified:source_block:")));
  assert.equal(deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds.length, 0);
  assert.ok(validateCampaignUnderstanding(understanding).some((issue) => issue.code === "UNRESOLVED_CLASSIFICATION"));
});

test("multiple documents preserve originating evidence, scopes, and conditional requirements", () => {
  const understanding = buildCampaignUnderstanding({
    profile: profile(),
    sourceDocuments: [
      { id: "brief-doc", kind: "brief", rawText: "Egypt: Instagram primary. Wave 1 awareness." },
      { id: "legal-doc", kind: "legal", rawText: "If boosting is used then client approval is required in KSA with Arabic deliverable." },
    ],
  });
  const legal = understanding.facts.find((fact) => fact.evidence[0]?.sourceDocumentId === "legal-doc")!;
  assert.equal(legal.condition?.clauses[0]?.factConcept, "paid_amplification");
  assert.ok(legal.scope?.selectors.some((selector) => selector.dimension === "market" && selector.values[0] === "Saudi Arabia"));
  assert.equal(deriveUnderstandingCoverage(understanding).sourceDocumentCount, 2);
  assert.equal(deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds.length, 0);
});

test("missing budget stays absent and Commercial remains blocked only through an explicit question", () => {
  const understanding = buildCampaignUnderstanding({ profile: profile(), sourceDocuments: [{ id: "brief-doc", kind: "brief", rawText: "Example Bank awareness in Egypt." }] });
  assert.equal(understanding.facts.some((fact) => fact.concept === "budget"), false);
  assert.ok(understanding.questions.some((question) => question.id === "missing-budget"));
  assert.equal(evaluateCampaignUnderstandingQualityGate(understanding, { stage: "commercial" }).status, "blocked");
});

test("versioned understanding survives the existing profile JSON compatibility envelope", () => {
  const campaignUnderstanding = buildCampaignUnderstanding({
    profile: profile(),
    sourceDocuments: [{ id: "brief-doc", kind: "brief", rawText: "Example Bank awareness in Egypt." }],
  });
  const restored = normalizeCampaignIntelligenceProfile(JSON.stringify({
    ...profile(),
    campaignUnderstanding,
  }));
  assert.equal(restored.campaignUnderstanding?.schemaVersion, 1);
  assert.equal(restored.campaignUnderstanding?.facts[0]?.origin, "SOURCE_STATED");
});

test("confirmation changes only understanding confirmation state, never fact provenance", () => {
  const campaignUnderstanding = buildCampaignUnderstanding({
    profile: profile(),
    sourceDocuments: [{ id: "brief-doc", kind: "brief", rawText: "Example Bank awareness in Egypt." }],
  });
  const confirmed = confirmCampaignIntelligenceProfile({ ...profile(), campaignUnderstanding }, "2026-09-12T00:00:00.000Z");
  assert.equal(confirmed.campaignUnderstanding?.confirmation.status, "confirmed");
  assert.equal(confirmed.campaignUnderstanding?.facts[0]?.origin, "SOURCE_STATED");
  const unconfirmed = unconfirmCampaignIntelligenceProfile(confirmed);
  assert.equal(unconfirmed.campaignUnderstanding?.confirmation.status, "unconfirmed");
  assert.equal(unconfirmed.campaignUnderstanding?.facts[0]?.origin, "SOURCE_STATED");
});
