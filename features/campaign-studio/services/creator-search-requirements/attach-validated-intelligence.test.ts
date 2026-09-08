/**
 * Phase 1 runtime wiring: canonical validated intelligence must reach CSR
 * through the ACTUAL production call chain, not just via a helper in isolation.
 *
 * Production chain under test:
 *   state.data.validatedCampaignIntelligence      (set by workflow-engine)
 *     → CampaignDirector.applyTaskResult(result, state.data)
 *       → applyTaskResultToCampaignObject(obj, result, stateData)
 *         → proposeInitialCreatorSlate(obj, { validated })
 *           → attachCreatorSearchRequirements(obj, { validated })
 *             → buildCreatorSearchRequirements({ validated, ... })
 *
 * No database access, no brief parsing, no selection behaviour.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignDirector } from "@/features/campaign-intelligence/services/campaign-director";
import {
  applyTaskResultToCampaignObject,
  createEmptyCampaignObject,
} from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { DIRECTOR_PIPELINE_STATE_KEY } from "@/features/campaign-director/services/campaign-director";
import type { NormalizedCampaignEntities } from "@/features/campaign-intelligence-profile/services/normalization/types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import { resolveValidatedIntelligenceForProfile } from "./attach-creator-search-requirements";

const NOW = "2026-01-01T00:00:00.000Z";
const PROFILE_ID = "cip-123";

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 2,
  createdAt: NOW,
  understanding: {
    brand: "BabyJoy",
    objective: "Awareness among Egyptian mothers",
    geography: "Egypt",
    audience: "Egyptian mothers",
    platforms: ["Instagram"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "Parenting-led.",
  pillars: [{ title: "Parenting", what: "Routines", why: "Trust" }],
  platformMix: [],
  creatorTierStrategy: [{ tier: "Macro", allocationPercent: 100, why: "Reach" }],
};

/** Values here appear NOWHERE in strategy or facts — so they prove provenance. */
const validatedIntelligence: ValidatedCampaignIntelligence = {
  brand: { brandName: "BabyJoy" },
  market: { countryCode: "EG", countryLabel: "Egypt", cities: ["Cairo"] },
  audience: {
    countries: ["EG"],
    cities: [],
    gender: "female",
    ageMin: 28,
    ageMax: 40,
    languages: ["ar"],
  },
  creator: {
    niches: ["motherhood"],
    creatorTypes: [],
    followerMin: 20_000,
    followerMax: 800_000,
    engagementMin: 2,
  },
  platforms: ["instagram"],
  categories: ["Parenting"],
  keywords: ["diapers"],
  brandSafety: "required",
  fieldEvidence: { platforms: { level: "extracted", confidence: 0.95 } },
  validatedAt: NOW,
};

const normalizedEntities: NormalizedCampaignEntities = {
  brand: { brandName: "BabyJoy" },
  market: { countryCode: "AE", countryLabel: "United Arab Emirates", cities: [] },
  audience: {
    countries: ["AE"],
    cities: [],
    gender: "female",
    ageMin: 25,
    ageMax: 35,
    languages: ["en"],
  },
  creator: { niches: ["parenting"], creatorTypes: [], followerMin: 5_000 },
  platforms: ["tiktok"],
  categories: ["Parenting"],
  keywords: ["wipes"],
  brandSafety: "preferred",
  fieldEvidence: {},
};

/** Built with the production factory so every section the updater touches exists. */
function campaignObject(creatorsData: CreatorsSectionData = {}): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
  });
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  object.meta = {
    ...object.meta,
    status: "building",
    campaignStrategyDocument: strategy,
    campaignFacts: {
      brandName: "BabyJoy",
      objective: "Awareness among mothers",
      platforms: ["Instagram"],
      geography: ["Egypt"],
      audience: "Mothers",
      extractedAt: NOW,
      confidence: {},
      sources: {},
    },
  } as unknown as CampaignObject["meta"];
  return object;
}

/** Workflow state exactly as the engine leaves it before applyTaskResult. */
function workflowStateData(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    campaignStrategyDocument: strategy,
    campaignIntelligenceProfileId: PROFILE_ID,
    [DIRECTOR_PIPELINE_STATE_KEY]: {
      strategyDocument: strategy,
      specialistOutputs: [],
      crossReviewFindings: [],
      challenges: [],
      approvedSections: [],
      approvalGate: {
        approved: true,
        unresolvedConflictCount: 0,
        crossReviewOpenCount: 0,
        revisionRounds: 1,
        blockers: [],
      },
    },
    ...overrides,
  };
}

const taskResult: WorkflowTaskResult = {
  taskId: "build-shortlist",
  status: "completed",
  agentId: "scout",
  content: "Ranked the vendor shortlist.",
  startedAt: NOW,
  completedAt: NOW,
} as unknown as WorkflowTaskResult;

function csrOf(object: CampaignObject) {
  return (object.sections.creators.data as CreatorsSectionData).searchRequirements;
}

/** Minimal stub of the single query getCampaignIntelligenceProfileById issues. */
function supabaseStub(
  result: { data: unknown; error: { message: string } | null },
  calls: string[] = []
): SupabaseClient {
  return {
    from(table: string) {
      calls.push(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => result,
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

// === PRODUCTION CHAIN =======================================================

test("PRODUCTION: applyTaskResultToCampaignObject passes workflow-state validated intelligence into CSR", () => {
  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: validatedIntelligence })
  );

  const csr = csrOf(updated);
  assert.ok(csr, "CSR must be attached by the production path");

  // Every one of these can ONLY come from validated intelligence.
  assert.equal(csr.search.audienceGender?.value, "female");
  assert.equal(csr.search.audienceAgeMin?.value, 28);
  assert.equal(csr.search.audienceAgeMax?.value, 40);
  assert.equal(csr.search.followerFloor?.value, 20_000);
  assert.equal(csr.search.followerCeiling?.value, 800_000);
  assert.equal(csr.search.engagementFloor?.value, 2);
  assert.equal(csr.search.brandSafety, "required");
  assert.deepEqual(csr.search.languages.map((l) => l.value), ["ar"]);
  assert.deepEqual(csr.search.niches.map((n) => n.value), ["motherhood"]);
  assert.deepEqual(csr.search.cities.map((c) => c.value), ["Cairo"]);
  assert.equal(csr.fieldEvidence.platforms?.confidence, 0.95);

  // Strategy still owns campaign intent.
  assert.equal(csr.strategyRef?.id, "strategy-1");
  assert.equal(csr.search.platforms[0]?.source, "strategy");
});

test("PRODUCTION: CampaignDirector.applyTaskResult carries validated intelligence through", () => {
  const director = new CampaignDirector(campaignObject());

  const updated = director.applyTaskResult(
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: validatedIntelligence })
  );

  const csr = csrOf(updated);
  assert.ok(csr);
  assert.equal(csr.search.audienceGender?.value, "female");
  assert.equal(csr.search.brandSafety, "required");
  assert.deepEqual(csr.search.languages.map((l) => l.value), ["ar"]);
});

test("PRODUCTION: without validated intelligence on state, CSR is Strategy + Facts only", () => {
  // This is the pre-fix behaviour — it must remain the fallback, not the norm.
  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    workflowStateData()
  );

  const csr = csrOf(updated);
  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.equal(csr.search.followerFloor, undefined);
  assert.equal(csr.search.brandSafety, "none");
  assert.deepEqual(csr.search.languages, []);
  // Strategy is still applied.
  assert.equal(csr.strategyRef?.id, "strategy-1");
});

test("PRODUCTION: normalizedEntities-derived intelligence also reaches CSR", async () => {
  // The engine resolves via getValidatedIntelligence(), which derives from
  // normalizedEntities when validatedIntelligence is absent.
  const supabase = supabaseStub({
    data: { id: PROFILE_ID, profile: { normalizedEntities } },
    error: null,
  });
  const resolved = await resolveValidatedIntelligenceForProfile(supabase, PROFILE_ID);
  assert.ok(resolved, "canonical helper derives from normalizedEntities");

  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: resolved })
  );

  const csr = csrOf(updated);
  assert.ok(csr);
  // AE / en / 25-35 appear nowhere in strategy or facts.
  assert.equal(csr.search.audienceAgeMin?.value, 25);
  assert.equal(csr.search.audienceAgeMax?.value, 35);
  assert.equal(csr.search.followerFloor?.value, 5_000);
  assert.deepEqual(csr.search.languages.map((l) => l.value), ["en"]);
  assert.deepEqual(csr.search.audienceCountries.map((c) => c.value), ["AE"]);
  assert.equal(csr.search.audienceCountries[0]?.source, "validated_intel");
});

// === RESOLVER (the engine's step) ===========================================

test("resolver returns profile.validatedIntelligence when present", async () => {
  const supabase = supabaseStub({ data: { profile: { validatedIntelligence } }, error: null });
  const resolved = await resolveValidatedIntelligenceForProfile(supabase, PROFILE_ID);
  assert.equal(resolved?.audience.ageMin, 28);
  assert.equal(resolved?.brandSafety, "required");
});

test("resolver issues no query without a profile id", async () => {
  const calls: string[] = [];
  const supabase = supabaseStub({ data: null, error: null }, calls);

  assert.equal(await resolveValidatedIntelligenceForProfile(supabase, undefined), undefined);
  assert.equal(await resolveValidatedIntelligenceForProfile(supabase, null), undefined);
  assert.equal(await resolveValidatedIntelligenceForProfile(supabase, "   "), undefined);
  assert.deepEqual(calls, []);
});

test("resolver falls back without throwing on a missing row or read error", async () => {
  assert.equal(
    await resolveValidatedIntelligenceForProfile(
      supabaseStub({ data: null, error: null }),
      PROFILE_ID
    ),
    undefined
  );
  assert.equal(
    await resolveValidatedIntelligenceForProfile(
      supabaseStub({ data: null, error: { message: "permission denied" } }),
      PROFILE_ID
    ),
    undefined
  );
});

test("resolver returns undefined for an empty profile", async () => {
  const supabase = supabaseStub({ data: { profile: {} }, error: null });
  assert.equal(await resolveValidatedIntelligenceForProfile(supabase, PROFILE_ID), undefined);
});

test("a legacy raw-field profile yields no search-relevant requirements", async () => {
  // normalizeCampaignIntelligenceProfile derives normalizedEntities from legacy
  // raw fields, so the canonical helper returns a value — but one with no
  // searchable signal. CSR must not invent anything from it.
  const supabase = supabaseStub({ data: { profile: { brandName: "BabyJoy" } }, error: null });
  const resolved = await resolveValidatedIntelligenceForProfile(supabase, PROFILE_ID);
  assert.ok(resolved);
  assert.deepEqual(resolved.platforms, []);
  assert.equal(resolved.brandSafety, "none");

  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: resolved })
  );
  const csr = csrOf(updated);
  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.deepEqual(csr.search.languages, []);
  assert.equal(csr.search.platforms[0]?.source, "strategy");
});

// === IDEMPOTENCE + SELECTION SAFETY =========================================

test("CSR currentness is unchanged: same strategy revision is not regenerated", () => {
  const first = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: validatedIntelligence })
  );
  const firstCsr = csrOf(first);

  const second = applyTaskResultToCampaignObject(
    first,
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: validatedIntelligence })
  );

  assert.equal(csrOf(second)?.generatedAt, firstCsr?.generatedAt);
  assert.equal(csrOf(second)?.strategyRef?.version, 2);
});

test("SELECTION SAFETY: validated intelligence does not change slate membership", () => {
  const creatorsData = {
    phase: "discovery",
    discovery: { creatorIds: ["cr-1", "cr-2", "cr-3", "cr-4", "cr-5"], total: 5 },
    recommendations: {
      creatorIds: [],
      selectedReasoning: [
        { creatorId: "cr-1", displayName: "One", handle: "@one", platform: "instagram", confidence: 0.92 },
        { creatorId: "cr-2", displayName: "Two", handle: "@two", platform: "instagram", confidence: 0.81 },
        { creatorId: "cr-3", displayName: "Three", handle: "@three", platform: "instagram", confidence: 0.74 },
        { creatorId: "cr-4", displayName: "Four", handle: "@four", platform: "tiktok", confidence: 0.66 },
        { creatorId: "cr-5", displayName: "Five", handle: "@five", platform: "instagram", confidence: 0.58 },
      ],
    },
  } as unknown as CreatorsSectionData;

  const withValidated = applyTaskResultToCampaignObject(
    campaignObject(creatorsData),
    taskResult,
    workflowStateData({ validatedCampaignIntelligence: validatedIntelligence })
  );
  const withoutValidated = applyTaskResultToCampaignObject(
    campaignObject(creatorsData),
    taskResult,
    workflowStateData()
  );

  const a = withValidated.sections.creators.data as CreatorsSectionData;
  const b = withoutValidated.sections.creators.data as CreatorsSectionData;

  assert.deepEqual(a.recommendations?.creatorIds, b.recommendations?.creatorIds);
  assert.deepEqual(a.recommendations?.creatorFitScores, b.recommendations?.creatorFitScores);
  assert.equal(a.recommendationsDisplay, b.recommendationsDisplay);
  assert.deepEqual(a.discovery?.creatorIds, b.discovery?.creatorIds);

  // ...while only CSR differs.
  assert.equal(a.searchRequirements?.search.brandSafety, "required");
  assert.equal(b.searchRequirements?.search.brandSafety, "none");
});
