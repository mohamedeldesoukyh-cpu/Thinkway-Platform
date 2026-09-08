/**
 * Phase 1 gap fix: validated intelligence must reach the CSR builder at runtime.
 *
 * These tests exercise the async attachment path with a stubbed Supabase client.
 * No real database access, no brief parsing, no selection behaviour.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { NormalizedCampaignEntities } from "@/features/campaign-intelligence-profile/services/normalization/types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

import {
  attachCreatorSearchRequirements,
  attachCreatorSearchRequirementsWithValidatedIntelligence,
  resolveValidatedIntelligenceForCampaignObject,
} from "./attach-creator-search-requirements";

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

function campaignObject(creatorsData: CreatorsSectionData = {}): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: { status: "complete", content: "", data: creatorsData },
      strategy: { status: "complete", content: "Parenting campaign" },
      summary: { status: "complete", content: "BabyJoy" },
      timeline: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
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
    },
  } as unknown as CampaignObject;
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

function requirementsOf(object: CampaignObject) {
  return (object.sections.creators.data as CreatorsSectionData).searchRequirements;
}

// A — validatedIntelligence reaches the builder -------------------------------

test("A: profile.validatedIntelligence reaches the CSR builder", async () => {
  const supabase = supabaseStub({
    data: { id: PROFILE_ID, profile: { validatedIntelligence } },
    error: null,
  });

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );

  const csr = requirementsOf(result);
  assert.ok(csr, "CSR should be attached");

  // Fields that can ONLY come from validated intelligence.
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

  // Strategy still wins for campaign intent.
  assert.equal(csr.strategyRef?.id, "strategy-1");
  assert.equal(csr.search.platforms[0]?.source, "strategy");
});

test("A: without the async path CSR carries no validated-only fields", async () => {
  // Demonstrates the gap this change closes.
  const syncOnly = attachCreatorSearchRequirements(
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );
  const csr = requirementsOf(syncOnly);

  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.equal(csr.search.followerFloor, undefined);
  assert.equal(csr.search.brandSafety, "none");
  assert.deepEqual(csr.search.languages, []);
});

// B — normalizedEntities fallback via getValidatedIntelligence ---------------

test("B: normalizedEntities are resolved by getValidatedIntelligence and reach the builder", async () => {
  const supabase = supabaseStub({
    data: { id: PROFILE_ID, profile: { normalizedEntities } },
    error: null,
  });

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );

  const csr = requirementsOf(result);
  assert.ok(csr);

  // Derived from normalizedEntities, not validatedIntelligence.
  assert.equal(csr.search.audienceAgeMin?.value, 25);
  assert.equal(csr.search.audienceAgeMax?.value, 35);
  assert.equal(csr.search.followerFloor?.value, 5_000);
  assert.deepEqual(csr.search.languages.map((l) => l.value), ["en"]);
  assert.deepEqual(csr.search.audienceCountries.map((c) => c.value), ["AE"]);
  assert.equal(csr.search.audienceCountries[0]?.source, "validated_intel");
});

test("B: the resolver returns the canonical value directly", async () => {
  const withValidated = supabaseStub({
    data: { profile: { validatedIntelligence } },
    error: null,
  });
  const resolved = await resolveValidatedIntelligenceForCampaignObject(
    withValidated,
    campaignObject({ cipProfileId: PROFILE_ID })
  );
  assert.equal(resolved?.audience.ageMin, 28);
  assert.equal(resolved?.brandSafety, "required");
});

// C — fallbacks preserved, never crashes -------------------------------------

test("C: no cipProfileId issues no query and preserves existing behaviour", async () => {
  const calls: string[] = [];
  const supabase = supabaseStub({ data: null, error: null }, calls);

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject(),
    { now: NOW }
  );

  assert.deepEqual(calls, [], "no profile read should be attempted");
  const csr = requirementsOf(result);
  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.equal(csr.search.brandSafety, "none");
});

test("C: a missing profile row falls back without throwing", async () => {
  const supabase = supabaseStub({ data: null, error: null });

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );

  const csr = requirementsOf(result);
  assert.ok(csr);
  assert.equal(csr.search.brandSafety, "none");
  assert.equal(csr.strategyRef?.id, "strategy-1", "Strategy is still applied");
});

test("C: a profile read error falls back without throwing", async () => {
  const supabase = supabaseStub({ data: null, error: { message: "permission denied" } });

  const resolved = await resolveValidatedIntelligenceForCampaignObject(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID })
  );
  assert.equal(resolved, undefined);

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );
  assert.ok(requirementsOf(result));
});

test("C: an empty profile resolves to undefined via the canonical helper", async () => {
  const supabase = supabaseStub({ data: { profile: {} }, error: null });

  const resolved = await resolveValidatedIntelligenceForCampaignObject(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID })
  );
  assert.equal(resolved, undefined);
});

test("C: a legacy raw-field profile yields no search-relevant requirements", async () => {
  // normalizeCampaignIntelligenceProfile derives normalizedEntities from legacy
  // raw fields, so getValidatedIntelligence returns a value — but one carrying
  // no searchable signal. CSR must not invent anything from it.
  const supabase = supabaseStub({ data: { profile: { brandName: "BabyJoy" } }, error: null });

  const resolved = await resolveValidatedIntelligenceForCampaignObject(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID })
  );
  assert.ok(resolved, "the canonical helper derives from legacy fields");
  assert.deepEqual(resolved.platforms, []);
  assert.deepEqual(resolved.categories, []);
  assert.equal(resolved.brandSafety, "none");

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );
  const csr = requirementsOf(result);
  assert.ok(csr);
  assert.equal(csr.search.audienceGender, undefined);
  assert.equal(csr.search.followerFloor, undefined);
  assert.deepEqual(csr.search.languages, []);
  // Strategy still drives platform selection.
  assert.equal(csr.search.platforms[0]?.source, "strategy");
});

// Idempotence / currentness is unchanged --------------------------------------

test("an up-to-date CSR is returned untouched and issues no profile read", async () => {
  const calls: string[] = [];
  const supabase = supabaseStub({
    data: { profile: { validatedIntelligence } },
    error: null,
  });
  const supabaseCounting = supabaseStub(
    { data: { profile: { validatedIntelligence } }, error: null },
    calls
  );

  const first = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );

  const second = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabaseCounting,
    first,
    { now: "2026-02-02T00:00:00.000Z" }
  );

  assert.equal(second, first, "same reference — no churn");
  assert.deepEqual(calls, [], "no profile read when CSR is already current");
});

test("a bumped strategy revision regenerates CSR and re-reads validated intelligence", async () => {
  const supabase = supabaseStub({ data: { profile: { validatedIntelligence } }, error: null });
  const first = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    campaignObject({ cipProfileId: PROFILE_ID }),
    { now: NOW }
  );

  const bumped = {
    ...first,
    meta: { ...first.meta, campaignStrategyDocument: { ...strategy, version: 3 } },
  } as unknown as CampaignObject;

  const second = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    bumped,
    { now: "2026-03-03T00:00:00.000Z" }
  );

  const csr = requirementsOf(second);
  assert.equal(csr?.strategyRef?.version, 3);
  assert.equal(csr?.generatedAt, "2026-03-03T00:00:00.000Z");
  assert.equal(csr?.search.audienceGender?.value, "female", "validated intelligence still applied");
});

// Selection safety -------------------------------------------------------------

test("the async attach adds only searchRequirements — nothing else changes", async () => {
  const supabase = supabaseStub({ data: { profile: { validatedIntelligence } }, error: null });
  const original = campaignObject({
    cipProfileId: PROFILE_ID,
    recommendations: { creatorIds: ["cr-1", "cr-2"] },
  } as unknown as CreatorsSectionData);
  const snapshot = structuredClone(original);

  const result = await attachCreatorSearchRequirementsWithValidatedIntelligence(
    supabase,
    original,
    { now: NOW }
  );

  assert.deepStrictEqual(original, snapshot, "input object is never mutated");

  const data = { ...(result.sections.creators.data as CreatorsSectionData) };
  assert.ok(data.searchRequirements);
  delete data.searchRequirements;
  assert.deepStrictEqual(data, snapshot.sections.creators.data);

  const rebuilt = {
    ...result,
    sections: {
      ...result.sections,
      creators: { ...result.sections.creators, data },
    },
  };
  assert.deepStrictEqual(rebuilt, snapshot);
});
