import assert from "node:assert/strict";
import test from "node:test";

import { applyDirectorPipelineToCampaignObject } from "../integrations/workflow-integration";
import type { DirectorPipelineResult, CampaignStrategyDocument } from "../types";
import { buildStrategyContext } from "@/features/campaign-intelligence-profile/services/campaign-understanding/build-strategy-context";
import { GOLDEN_BRIEF_CORPUS } from "@/features/campaign-intelligence-profile/services/campaign-understanding/golden-brief-corpus";
import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";

import { fingerprintStrategyContext, resolveStrategyBasisStatus } from "./strategy-basis";

const NOW = "2026-09-12T00:00:00.000Z";

function context() {
  return buildStrategyContext(structuredClone(GOLDEN_BRIEF_CORPUS[0].understanding))!;
}

function campaignObject(): CampaignObject {
  const section = { content: "before", status: "pending" as const };
  return {
    id: "campaign-1",
    updatedAt: NOW,
    sections: {
      summary: section, audience: section, strategy: section, creators: section,
      budget: section, timeline: section, performance: section, presentation: section, operations: section,
    },
    meta: { status: "draft", specialistProgress: [], directorPipeline: { approved: false } },
  };
}

function strategy(overrides: Partial<CampaignStrategyDocument> = {}): CampaignStrategyDocument {
  const strategyContext = context();
  return {
    id: "strategy-1", version: 1, createdAt: NOW,
    strategyContext,
    campaignUnderstandingRef: strategyContext.campaignUnderstandingRef,
    readiness: strategyContext.readiness,
    status: "ready",
    understanding: { brand: "Brand", objective: "Objective", audience: "Audience", platforms: [], kpis: [], risks: [], constraints: [] },
    narrative: "Strategy", pillars: [], platformMix: [], creatorTierStrategy: [],
    ...overrides,
  };
}

function pipeline(document = strategy()): DirectorPipelineResult {
  return {
    strategyDocument: document,
    specialistOutputs: [], crossReviewFindings: [], challenges: [],
    approvalGate: { approved: true, unresolvedConflictCount: 0, crossReviewOpenCount: 0, revisionRounds: 1, blockers: [] },
    approvedSections: [{ sectionKey: "strategy", content: "approved strategy", rationale: "grounded", approvedBy: "strategy" }],
  };
}

test("Director Strategy write atomically preserves the section and its basis provenance", () => {
  const before = campaignObject();
  const after = applyDirectorPipelineToCampaignObject(before, pipeline());
  const basis = after.meta.directorPipeline!.strategyBasis!;

  assert.equal(after.sections.strategy.content, "approved strategy");
  assert.equal(after.meta.directorPipeline!.strategyDocumentId, "strategy-1");
  assert.equal(basis.campaignUnderstanding.schemaVersion, 1);
  assert.equal(basis.campaignUnderstanding.confirmationStatus, "confirmed");
  assert.equal(basis.readiness.status, "ready");
  assert.equal(resolveStrategyBasisStatus(after, context()), "CURRENT");
  assert.equal(after.sections.budget, before.sections.budget);
  assert.equal(after.meta.status, before.meta.status);
});

test("StrategyContext fingerprints ignore timestamps and ordering but capture material changes", () => {
  const first = context();
  const reordered = structuredClone(first);
  reordered.coreFacts.reverse();
  reordered.campaignUnderstandingRef.confirmedAt = "2027-01-01T00:00:00.000Z";
  assert.equal(fingerprintStrategyContext(first), fingerprintStrategyContext(reordered));

  const changed = structuredClone(first);
  changed.coreFacts[0] = { ...changed.coreFacts[0], value: "materially changed" };
  assert.notEqual(fingerprintStrategyContext(first), fingerprintStrategyContext(changed));
});

test("basis preserves warning and blocked readiness and resolves stale, legacy, and missing states", () => {
  const warningContext = context();
  warningContext.readiness.strategy = { ...warningContext.readiness.strategy, status: "warning" };
  const warningStrategy = strategy({ strategyContext: warningContext, campaignUnderstandingRef: warningContext.campaignUnderstandingRef, readiness: warningContext.readiness });
  const warningObject = applyDirectorPipelineToCampaignObject(campaignObject(), pipeline(warningStrategy));
  assert.equal(warningObject.meta.directorPipeline!.strategyBasis!.readiness.status, "warning");

  const blockedContext = context();
  blockedContext.readiness.strategy = { ...blockedContext.readiness.strategy, status: "blocked" };
  const blockedStrategy = strategy({ strategyContext: blockedContext, campaignUnderstandingRef: blockedContext.campaignUnderstandingRef, readiness: blockedContext.readiness, status: "blocked" });
  const blockedObject = applyDirectorPipelineToCampaignObject(campaignObject(), pipeline(blockedStrategy));
  assert.equal(blockedObject.meta.directorPipeline!.strategyBasis!.readiness.status, "blocked");
  assert.equal(resolveStrategyBasisStatus(blockedObject, blockedContext), "BLOCKED");

  const changed = context();
  changed.coreFacts[0] = { ...changed.coreFacts[0], value: "changed" };
  assert.equal(resolveStrategyBasisStatus(warningObject, changed), "STALE");
  const legacy = campaignObject();
  legacy.meta.directorPipeline = { approved: true, strategyDocumentId: "legacy-strategy" };
  assert.equal(resolveStrategyBasisStatus(legacy, context()), "LEGACY_UNKNOWN");
  assert.equal(resolveStrategyBasisStatus(campaignObject(), context()), "MISSING");
  assert.equal("strategyBasis" in legacy.meta.directorPipeline, false);
});
