import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { buildStrategyBasis } from "@/features/campaign-director/services/strategy-basis";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { buildStrategyContext } from "@/features/campaign-intelligence-profile/services/campaign-understanding/build-strategy-context";
import { GOLDEN_BRIEF_CORPUS } from "@/features/campaign-intelligence-profile/services/campaign-understanding/golden-brief-corpus";
import type { CampaignUnderstanding } from "@/features/campaign-intelligence-profile/types/campaign-understanding";

import { buildContentContext } from "./content-context";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { regeneratePlanSectionsFromSlate } from "./plan-section-regeneration";
import { resolveContentPlanState } from "./section-data-resolver";

const NOW = "2026-09-12T00:00:00.000Z";

function understanding(): CampaignUnderstanding {
  const result = structuredClone(GOLDEN_BRIEF_CORPUS[0]!.understanding);
  const source = result.facts[0]!;
  result.facts.push({
    ...source,
    id: "cta",
    concept: "cta",
    label: "CTA",
    value: "Apply today",
  });
  result.confirmation = { status: "confirmed", confirmedFactIds: result.facts.map((fact) => fact.id) };
  return result;
}

function strategyDocument(source: CampaignUnderstanding, status: "ready" | "blocked" = "ready") {
  const context = buildStrategyContext(source)!;
  return {
    id: "strategy-content-context",
    version: 1,
    createdAt: NOW,
    strategyContext: context,
    campaignUnderstandingRef: context.campaignUnderstandingRef,
    readiness: context.readiness,
    status,
    understanding: { brand: "Example", objective: "Awareness", audience: "Egypt", platforms: [], kpis: [], risks: [], constraints: [] },
    narrative: "Current strategy",
    pillars: [],
    platformMix: [],
    creatorTierStrategy: [],
  } as CampaignStrategyDocument;
}

function campaignObject(source = understanding()): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "content-context-campaign",
    conversationId: "content-context-conversation",
    workflowId: "create-campaign",
  });
  const document = strategyDocument(source);
  object.meta.campaignFacts = {
    extractedAt: NOW,
    confidence: {},
    sources: {},
    objective: "Build awareness",
    audience: "Egyptian adults",
    platforms: ["Instagram"],
    kpis: ["Reach"],
    deliverables: ["Instagram Reel"],
    durationWeeks: 4,
  };
  object.meta.directorPipeline = {
    approved: true,
    strategyDocumentId: document.id,
    strategyBasis: buildStrategyBasis(document),
  };
  object.sections.strategy.data = {
    creativeConcepts: [{ name: "Proof", bigIdea: "Demonstrate the benefit", contentTheme: "Benefit proof", hook: "See it work", cta: "Apply today" }],
  };
  object.sections.creators.data = {
    recommendations: {
      creatorIds: ["creator-1", "creator-2"],
      selectedReasoning: [
        { creatorId: "creator-1", displayName: "Creator One", platform: "Instagram", expectedRole: "Macro", whySelected: "Reach" },
        { creatorId: "creator-2", displayName: "Creator Two", platform: "Instagram", expectedRole: "Micro", whySelected: "Trust" },
      ],
    },
  };
  return object;
}

test("ContentContext consumes confirmed Campaign Understanding and a CURRENT Strategy basis", () => {
  const source = understanding();
  const object = campaignObject(source);
  const context = buildContentContext({ campaignObject: object, campaignUnderstanding: source });
  assert.equal(context.strategy.basisStatus, "CURRENT");
  assert.equal(context.campaignUnderstanding?.confirmationStatus, "confirmed");
  assert.deepEqual(context.creators.map((creator) => creator.creatorId), ["creator-1", "creator-2"]);
  assert.equal(context.cta, "Apply today");
  assert.equal(context.readiness.status, "READY");
  assert.equal(context.requirements.find((fact) => fact.concept === "cta")?.origin, "SOURCE_STATED");

  const live = resolveContentPlanState(object, undefined, source)!;
  const regenerated = regeneratePlanSectionsFromSlate(object, [], source);
  assert.deepEqual(regenerated.sections.timeline.data?.contentPlan, live.items);
  assert.deepEqual(regenerated.sections.timeline.data?.contentPlanState?.readiness, live.context.readiness);
});

test("Content readiness gates stale, blocked, and legacy Strategy authority without mutating legacy objects", () => {
  const source = understanding();
  const staleSource = structuredClone(source);
  staleSource.facts[0] = { ...staleSource.facts[0]!, value: "Saudi Arabia" };
  assert.equal(buildContentContext({ campaignObject: campaignObject(source), campaignUnderstanding: staleSource }).strategy.basisStatus, "STALE");
  assert.equal(buildContentContext({ campaignObject: campaignObject(source), campaignUnderstanding: staleSource }).readiness.status, "BLOCKED");

  const blocked = campaignObject(source);
  blocked.meta.directorPipeline!.strategyBasis = {
    ...blocked.meta.directorPipeline!.strategyBasis!,
    readiness: { ...blocked.meta.directorPipeline!.strategyBasis!.readiness, status: "blocked" },
  };
  assert.equal(buildContentContext({ campaignObject: blocked, campaignUnderstanding: source }).strategy.basisStatus, "BLOCKED");

  const legacy = campaignObject(source);
  legacy.meta.directorPipeline = { approved: true, strategyDocumentId: "legacy" };
  const before = structuredClone(legacy);
  const context = buildContentContext({ campaignObject: legacy });
  assert.equal(context.strategy.basisStatus, "LEGACY_UNKNOWN");
  assert.equal(context.readiness.status, "WARNING");
  assert.deepEqual(legacy, before);

  const missing = campaignObject(source);
  missing.meta.directorPipeline = { approved: true };
  const missingContext = buildContentContext({ campaignObject: missing, campaignUnderstanding: source });
  assert.equal(missingContext.strategy.basisStatus, "MISSING");
  assert.equal(missingContext.strategy.creativeConcepts, undefined);

  const unconfirmed = structuredClone(source);
  unconfirmed.confirmation = { status: "unconfirmed", confirmedFactIds: [] };
  const unconfirmedContext = buildContentContext({ campaignObject: campaignObject(source), campaignUnderstanding: unconfirmed });
  assert.equal(unconfirmedContext.campaignUnderstanding, undefined);
  assert.ok(unconfirmedContext.readiness.warnings.some((warning) => /not confirmed/i.test(warning)));
});

test("blocked Content emits no recommendation rows and retains exact blocker state through live and regeneration paths", () => {
  const source = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "regulated-claims")!.understanding);
  source.facts.push({ ...source.facts[0]!, id: "cta", concept: "cta", value: "Apply today" });
  source.confirmation = { status: "confirmed", confirmedFactIds: source.facts.map((fact) => fact.id) };
  const object = campaignObject(source);
  const live = resolveContentPlanState(object, undefined, source)!;
  assert.equal(live.context.readiness.status, "BLOCKED");
  assert.ok(live.context.readiness.blockers.length > 0);
  assert.deepEqual(live.items, []);
  assert.deepEqual(deriveInfluencerContentPlan(live.context), []);

  const regenerated = regeneratePlanSectionsFromSlate(object, [], source);
  const persisted = regenerated.sections.timeline.data?.contentPlanState;
  assert.equal(persisted?.readiness.status, "BLOCKED");
  assert.deepEqual(persisted?.readiness.blockers, live.context.readiness.blockers);
  assert.deepEqual(regenerated.sections.timeline.data?.contentPlan, []);
});

test("warning stays explicit, excludes rejected creators, and never turns conditional or excluded platforms into a normal fallback", () => {
  const source = understanding();
  source.facts.push({
    ...source.facts[0]!,
    id: "conditional-tiktok",
    concept: "platform_directive",
    value: "TikTok",
    condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] },
  });
  source.confirmation.confirmedFactIds = source.facts.map((fact) => fact.id);
  const object = campaignObject(source);
  object.sections.creators.data = {
    ...(object.sections.creators.data as Record<string, unknown>),
    vendorDecisions: { "creator-2": "rejected" },
  };
  const live = resolveContentPlanState(object, undefined, source)!;
  assert.equal(live.context.readiness.status, "READY");
  assert.deepEqual(live.items.map((item) => item.creatorId), ["creator-1"]);
  assert.equal(live.context.platforms.find((item) => item.platform === "TikTok")?.priority, "conditional");
  assert.ok(live.items.every((item) => item.platform !== "TikTok"));

  const warningSource = structuredClone(source);
  warningSource.facts = warningSource.facts.filter((fact) => fact.id !== "cta");
  warningSource.confirmation.confirmedFactIds = warningSource.facts.map((fact) => fact.id);
  const warningObject = campaignObject(warningSource);
  const warningStrategy = warningObject.sections.strategy.data as { creativeConcepts: Array<{ cta?: string }> };
  warningStrategy.creativeConcepts[0]!.cta = undefined;
  const warning = resolveContentPlanState(warningObject, undefined, warningSource)!;
  assert.equal(warning.context.readiness.status, "WARNING");
  assert.equal(warning.items[0]?.cta, undefined);

  const excluded = structuredClone(source);
  excluded.facts.push({ ...excluded.facts[0]!, id: "exclude-instagram", concept: "platform_excluded", value: "Instagram" });
  excluded.confirmation.confirmedFactIds = excluded.facts.map((fact) => fact.id);
  const unsafe = resolveContentPlanState(campaignObject(excluded), undefined, excluded)!;
  assert.equal(unsafe.context.readiness.status, "BLOCKED");
  assert.deepEqual(unsafe.items, []);
});
