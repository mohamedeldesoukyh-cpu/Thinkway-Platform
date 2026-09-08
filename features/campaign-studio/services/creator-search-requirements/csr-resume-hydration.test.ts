/**
 * Workflow-state contract regression.
 *
 * Contract: whenever workflow state carries `campaignIntelligenceProfileId`,
 * it must also carry `validatedCampaignIntelligence` for that same profile
 * BEFORE any production path can generate/attach CSR.
 *
 * The bootstrap block in the engine only resolves validated intelligence on the
 * run that creates the profile. A RESUMED workflow already carries the id, so
 * without the init/resume hydration step CSR silently fell back to
 * Strategy + Facts. These tests pin that fix.
 *
 * No real database access, no brief parsing, no selection behaviour.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

import { hydrateValidatedIntelligenceOnState } from "./attach-creator-search-requirements";
import {
  applyTaskResultToCampaignObject,
  createEmptyCampaignObject,
} from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { DIRECTOR_PIPELINE_STATE_KEY } from "@/features/campaign-director/services/campaign-director";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { getValidatedIntelligence } from "@/features/campaign-intelligence-profile/services/get-validated-intelligence";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

/** Structural stand-in for WorkflowState — only `data` matters here. */
type TestWorkflowState = { data: Record<string, unknown> };

const NOW = "2026-01-01T00:00:00.000Z";
const PROFILE_ID = "cip-resume-1";
const OTHER_PROFILE_ID = "cip-resume-2";

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

/** None of these values appear in strategy or facts — so they prove provenance. */
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
  fieldEvidence: {},
  validatedAt: NOW,
};

/** A different profile, to prove a changed id is re-resolved rather than stale. */
const otherValidatedIntelligence: ValidatedCampaignIntelligence = {
  ...validatedIntelligence,
  audience: { ...validatedIntelligence.audience, ageMin: 18, ageMax: 24, languages: ["fr"] },
  brandSafety: "none",
};

function supabaseStub(
  resultFor: (id: string) => { data: unknown; error: { message: string } | null },
  calls: string[] = []
): SupabaseClient {
  return {
    from() {
      let requestedId = "";
      const chain = {
        select: () => chain,
        eq: (_column: string, value: string) => {
          requestedId = value;
          return chain;
        },
        maybeSingle: async () => {
          calls.push(requestedId);
          return resultFor(requestedId);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

function profileRowStub(calls: string[] = []): SupabaseClient {
  return supabaseStub((id) => {
    if (id === PROFILE_ID) {
      return { data: { id, profile: { validatedIntelligence } }, error: null };
    }
    if (id === OTHER_PROFILE_ID) {
      return {
        data: { id, profile: { validatedIntelligence: otherValidatedIntelligence } },
        error: null,
      };
    }
    return { data: null, error: null };
  }, calls);
}

/** Workflow state as a RESUMED create-campaign run leaves it: id present, no validated. */
function resumedState(overrides: Record<string, unknown> = {}): TestWorkflowState {
  return {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 4,
    taskResults: {},
    status: "running",
    data: {
      campaignIntelligenceProfileId: PROFILE_ID,
      // Present on a resume — this is what makes the engine skip the bootstrap block.
      campaignStrategyDocument: strategy,
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
    },
  } as unknown as TestWorkflowState;
}

function campaignObject(): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
  });
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

const taskResult = {
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

// === 2 — RESUME: the gap this fix closes ====================================

test("RESUME REGRESSION: a resumed workflow without validated intelligence is hydrated", async () => {
  const calls: string[] = [];
  const state = resumedState();

  // Pre-condition: the exact broken shape — id present, validated absent.
  assert.equal(state.data.campaignIntelligenceProfileId, PROFILE_ID);
  assert.equal(state.data.validatedCampaignIntelligence, undefined);

  await hydrateValidatedIntelligenceOnState(state, profileRowStub(calls), PROFILE_ID);

  assert.deepEqual(calls, [PROFILE_ID], "exactly one profile read");
  assert.ok(state.data.validatedCampaignIntelligence, "contract now satisfied");
  assert.equal(state.data.validatedCampaignIntelligenceProfileId, PROFILE_ID);
});

test("RESUME REGRESSION: the hydrated state carries validated intelligence into CSR", async () => {
  const state = resumedState();
  await hydrateValidatedIntelligenceOnState(state, profileRowStub(), PROFILE_ID);

  const updated = applyTaskResultToCampaignObject(campaignObject(), taskResult, state.data);
  const csr = csrOf(updated);

  assert.ok(csr, "CSR attached on the resume path");
  // Validated-only fields — impossible without the hydration step.
  assert.equal(csr.search.audienceGender?.value, "female");
  assert.equal(csr.search.audienceAgeMin?.value, 28);
  assert.equal(csr.search.audienceAgeMax?.value, 40);
  assert.equal(csr.search.followerFloor?.value, 20_000);
  assert.equal(csr.search.engagementFloor?.value, 2);
  assert.equal(csr.search.brandSafety, "required");
  assert.deepEqual(csr.search.languages.map((l) => l.value), ["ar"]);
  assert.deepEqual(csr.search.cities.map((c) => c.value), ["Cairo"]);
});

test("RESUME REGRESSION: without hydration the same state falls back to Strategy + Facts", () => {
  // Documents the pre-fix behaviour the hydration step removes.
  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    taskResult,
    resumedState().data
  );
  const csr = csrOf(updated);

  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.equal(csr.search.brandSafety, "none");
  assert.deepEqual(csr.search.languages, []);
  assert.equal(csr.strategyRef?.id, "strategy-1");
});

// === 1 — FRESH: both keys from the same canonical profile ===================

test("FRESH: bootstrap populates both keys from one canonical profile with no extra query", async () => {
  // Mirrors the engine bootstrap block, which holds the profile row already.
  const calls: string[] = [];
  const state = {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    currentTaskIndex: 0,
    taskResults: {},
    status: "running",
    data: {} as Record<string, unknown>,
  } as unknown as TestWorkflowState;

  const profile = normalizeCampaignIntelligenceProfile({ validatedIntelligence });
  state.data.campaignIntelligenceProfileId = PROFILE_ID;
  state.data.validatedCampaignIntelligence = getValidatedIntelligence(profile);
  state.data.validatedCampaignIntelligenceProfileId = PROFILE_ID;

  assert.ok(state.data.validatedCampaignIntelligence);
  assert.equal(
    state.data.validatedCampaignIntelligenceProfileId,
    state.data.campaignIntelligenceProfileId,
    "both keys describe the same canonical profile"
  );

  // The init/resume seam then no-ops — no redundant read on a fresh run.
  await hydrateValidatedIntelligenceOnState(state, profileRowStub(calls), PROFILE_ID);
  assert.deepEqual(calls, [], "no query when the value already belongs to this profile");
});

// === Query discipline: never per-task =======================================

test("hydration is idempotent — repeated calls issue no further queries", async () => {
  const calls: string[] = [];
  const supabase = profileRowStub(calls);
  const state = resumedState();

  await hydrateValidatedIntelligenceOnState(state, supabase, PROFILE_ID);
  await hydrateValidatedIntelligenceOnState(state, supabase, PROFILE_ID);
  await hydrateValidatedIntelligenceOnState(state, supabase, PROFILE_ID);

  assert.deepEqual(calls, [PROFILE_ID], "resolved once, then cached on state");
});

test("a profile id that changes mid-workflow is re-resolved, not left stale", async () => {
  const calls: string[] = [];
  const supabase = profileRowStub(calls);
  const state = resumedState();

  await hydrateValidatedIntelligenceOnState(state, supabase, PROFILE_ID);
  assert.equal(
    (state.data.validatedCampaignIntelligence as ValidatedCampaignIntelligence).audience.ageMin,
    28
  );

  await hydrateValidatedIntelligenceOnState(state, supabase, OTHER_PROFILE_ID);
  assert.deepEqual(calls, [PROFILE_ID, OTHER_PROFILE_ID]);
  assert.equal(
    (state.data.validatedCampaignIntelligence as ValidatedCampaignIntelligence).audience.ageMin,
    18
  );
  assert.equal(state.data.validatedCampaignIntelligenceProfileId, OTHER_PROFILE_ID);
});

// === 3 — Fallbacks preserved, never crashes =================================

test("no profile id issues no query and leaves state untouched", async () => {
  const calls: string[] = [];
  const supabase = profileRowStub(calls);
  const state = resumedState();
  delete state.data.campaignIntelligenceProfileId;

  await hydrateValidatedIntelligenceOnState(state, supabase, undefined);
  await hydrateValidatedIntelligenceOnState(state, supabase, null);
  await hydrateValidatedIntelligenceOnState(state, supabase, "   ");

  assert.deepEqual(calls, []);
  assert.equal(state.data.validatedCampaignIntelligence, undefined);
});

test("no supabase client issues no query and does not throw", async () => {
  const state = resumedState();
  await hydrateValidatedIntelligenceOnState(state, undefined, PROFILE_ID);
  assert.equal(state.data.validatedCampaignIntelligence, undefined);
});

test("a missing profile row leaves the contract unsatisfied without throwing", async () => {
  const calls: string[] = [];
  const state = resumedState({ campaignIntelligenceProfileId: "cip-missing" });

  await hydrateValidatedIntelligenceOnState(state, profileRowStub(calls), "cip-missing");

  assert.deepEqual(calls, ["cip-missing"]);
  assert.equal(state.data.validatedCampaignIntelligence, undefined);

  // CSR still generates, falling back to Strategy + Facts.
  const updated = applyTaskResultToCampaignObject(campaignObject(), taskResult, state.data);
  const csr = csrOf(updated);
  assert.ok(csr);
  assert.equal(csr.strategyRef?.id, "strategy-1");
  assert.equal(csr.search.brandSafety, "none");
});

test("a profile read error falls back without throwing", async () => {
  const state = resumedState();
  const supabase = supabaseStub(() => ({ data: null, error: { message: "permission denied" } }));

  await hydrateValidatedIntelligenceOnState(state, supabase, PROFILE_ID);
  assert.equal(state.data.validatedCampaignIntelligence, undefined);

  const updated = applyTaskResultToCampaignObject(campaignObject(), taskResult, state.data);
  assert.ok(csrOf(updated));
});
