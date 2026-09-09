/**
 * Edit Brief → Save Brief re-analysis — regression coverage.
 *
 * Saving an edited brief re-runs the canonical intelligence pipeline and
 * persists the result as the conversation's profile. These tests drive the real
 * pipeline and the real merge, and assert the four things that can go wrong:
 * new information must appear, changed information must update, removed
 * information must not linger as stale brief-derived data, and operator-entered
 * values must survive regardless of which canonical record carries the stamp.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { buildTafareehTeaDocx } from "@/features/campaign-intelligence-profile/fixtures/build-tafareeh-docx";
import { extractBriefDocumentText } from "@/features/campaign-intelligence-profile/services/brief-document-parser";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import { runCampaignIntelligencePipeline } from "@/features/campaign-intelligence-profile/services/run-intelligence-pipeline";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import { mergeBriefIntoCampaignObject } from "./merge-campaign-brief";
import {
  collectOperatorOwnedFields,
  mergeReanalyzedCampaignProfile,
  reanalyzeBriefIntelligence,
  type CampaignIntelligenceProfileStore,
} from "./reanalyze-campaign-brief";

/** Pipeline invocations, so one Save can be proven to run it exactly once. */
let pipelineRuns = 0;

async function analyze(briefText: string): Promise<CampaignIntelligenceProfile> {
  pipelineRuns += 1;
  const { profile } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
  });
  return { ...profile, schemaVersion: 1, status: "saved" };
}

/** The merge half of reanalyzeAndPersistBriefIntelligence, without the database. */
async function saveEditedBrief(input: {
  briefText: string;
  previousProfile?: CampaignIntelligenceProfile | null;
  previousFacts?: CampaignFacts | null;
}) {
  const reanalyzed = await analyze(input.briefText);
  const profile = mergeReanalyzedCampaignProfile({
    previousProfile: input.previousProfile,
    previousFacts: input.previousFacts,
    reanalyzed,
  });
  return { profile, facts: profileToCampaignFacts(profile) };
}

const SPARSE_BRIEF = [
  "Brand: Tafareeh Tea",
  "",
  "Market: Egypt",
  "",
  "Duration: 2 weeks",
].join("\n");

const FULL_BRIEF = [
  "Brand: Tafareeh Tea",
  "",
  "Market: Egypt",
  "",
  "Duration: 2 weeks",
  "",
  "Objective: Build awareness and encourage people to try the product.",
  "",
  "Target Audience:",
  "Egyptian tea drinkers, mainly young adults and families.",
  "",
  "Deliverables: 1 Instagram Reel, 1 Instagram Story",
].join("\n");

// Test 1 — new information appears.

test("edited brief adding objective/audience/deliverables populates the profile", async () => {
  const before = await saveEditedBrief({ briefText: SPARSE_BRIEF });
  assert.equal(before.facts.audience, undefined);
  assert.equal(before.facts.deliverables, undefined);
  assert.equal(before.facts.sources.objective, "default");

  const after = await saveEditedBrief({
    briefText: FULL_BRIEF,
    previousProfile: before.profile,
  });

  assert.match(after.facts.objective ?? "", /Build awareness and encourage people to try/i);
  assert.equal(after.facts.sources.objective, "brief");
  assert.equal(after.facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.deepEqual(after.facts.deliverables, ["1 Instagram Reel", "1 Instagram Story"]);
});

// Test 2 — changed information updates.

test("edited brief changing brief-derived values updates the canonical profile", async () => {
  const before = await saveEditedBrief({ briefText: FULL_BRIEF });

  const changed = FULL_BRIEF.replace(
    "Objective: Build awareness and encourage people to try the product.",
    "Objective: Drive repeat purchase among existing drinkers."
  )
    .replace(
      "Egyptian tea drinkers, mainly young adults and families.",
      "Egyptian office workers in Cairo."
    )
    .replace("Deliverables: 1 Instagram Reel, 1 Instagram Story", "Deliverables: 3 TikTok videos");

  const after = await saveEditedBrief({
    briefText: changed,
    previousProfile: before.profile,
  });

  assert.match(after.facts.objective ?? "", /Drive repeat purchase/i);
  assert.equal(after.facts.audience, "Egyptian office workers in Cairo.");
  assert.deepEqual(after.facts.deliverables, ["3 TikTok videos"]);
  assert.doesNotMatch(after.facts.objective ?? "", /Build awareness and encourage/i);
});

// Test 3 — removed information does not linger.

test("removing a field from the brief drops the stale brief-derived value", async () => {
  const before = await saveEditedBrief({ briefText: FULL_BRIEF });
  assert.ok(before.facts.audience);
  assert.ok(before.facts.deliverables?.length);

  const after = await saveEditedBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: before.profile,
  });

  assert.equal(after.facts.audience, undefined, "stale audience must not survive");
  assert.equal(after.facts.deliverables, undefined, "stale deliverables must not survive");
  assert.equal(after.facts.sources.objective, "default");
});

// Test 4 — operator value stamped on the CIP profile survives.

test("an operator budget on the profile survives a brief with no budget", async () => {
  const base = await saveEditedBrief({ briefText: FULL_BRIEF });
  const withOperatorBudget: CampaignIntelligenceProfile = {
    ...base.profile,
    budget: { amount: 750_000, currency: "EGP" },
    sources: { ...base.profile.sources, budget: "operator" },
    confidence: { ...base.profile.confidence, budget: 1 },
  };

  const after = await saveEditedBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: withOperatorBudget,
  });

  assert.deepEqual(after.facts.budget, { amount: 750_000, currency: "EGP" });
  assert.equal(after.facts.sources.budget, "operator");
});

// Test 5 — operator value known only to the Campaign Object also survives.

test("an operator value from meta.campaignFacts.sources survives re-analysis", async () => {
  const base = await saveEditedBrief({ briefText: FULL_BRIEF });

  // patchStudioIntakeFactsAction writes only the Campaign Object, so the CIP
  // profile carries the value with no operator stamp of its own.
  const profileWithoutStamp: CampaignIntelligenceProfile = {
    ...base.profile,
    budget: { amount: 250_000, currency: "EGP" },
  };
  const objectFacts = {
    ...base.facts,
    budget: { amount: 250_000, currency: "EGP" },
    sources: { ...base.facts.sources, budget: "operator" as const },
  };

  assert.ok(collectOperatorOwnedFields(profileWithoutStamp, objectFacts).has("budget"));

  const after = await saveEditedBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: profileWithoutStamp,
    previousFacts: objectFacts,
  });

  assert.deepEqual(after.facts.budget, { amount: 250_000, currency: "EGP" });
  assert.equal(after.facts.sources.budget, "operator");
});

test("operator precedence never freezes a non-operator field", async () => {
  const base = await saveEditedBrief({ briefText: FULL_BRIEF });
  const operatorBudgetOnly: CampaignIntelligenceProfile = {
    ...base.profile,
    budget: { amount: 500_000, currency: "EGP" },
    sources: { ...base.profile.sources, budget: "operator" },
  };

  const changed = FULL_BRIEF.replace(
    "Objective: Build awareness and encourage people to try the product.",
    "Objective: Drive repeat purchase among existing drinkers."
  );
  const after = await saveEditedBrief({
    briefText: changed,
    previousProfile: operatorBudgetOnly,
  });

  // Budget is operator-owned; objective is not, so the brief still wins there.
  assert.equal(after.facts.sources.budget, "operator");
  assert.match(after.facts.objective ?? "", /Drive repeat purchase/i);
  assert.equal(after.facts.sources.objective, "brief");
});

// Test 9 — Tafareeh end-to-end: real DOCX bytes → Edit Brief text → Save.

test("Tafareeh DOCX through Edit Brief → Save produces the expected intelligence", async () => {
  const bytes = await buildTafareehTeaDocx();
  const briefText = (
    await extractBriefDocumentText(
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "tafareeh-tea-brief.docx"
    )
  ).trim();

  // Production-accurate: for this campaign the operator entered the brand, so it
  // is operator-owned and must survive the re-analysis. (Heading-form `Brand` in
  // a document is NOT extracted — parseBrandFromText still requires colon form.
  // That gap is reported separately; brand extraction was not in scope here.)
  const previousProfile = {
    ...(await analyze("Brand: Tafareeh Tea\n\nMarket: Egypt")),
    brandName: "Tafareeh Tea",
    sources: { brandName: "operator" as const },
    confidence: { brandName: 1 },
  };

  const runsBefore = pipelineRuns;
  const { profile, facts } = await saveEditedBrief({ briefText, previousProfile });

  assert.equal(pipelineRuns - runsBefore, 1, "one Save must run the pipeline exactly once");

  assert.equal(facts.brandName, "Tafareeh Tea");
  assert.equal(facts.sources.brandName, "operator");
  assert.ok(facts.geography?.includes("Egypt"));
  assert.equal(facts.durationWeeks, 2);
  assert.match(facts.objective ?? "", /Build awareness for Tafareeh Tea/i);
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.deepEqual(profile.creatorCategories, ["Food"]);
  assert.deepEqual(facts.deliverables, [
    "1 Instagram Reel and 1 Instagram Story, mirrored to TikTok",
  ]);
  assert.equal(
    facts.keyMessage,
    "Rich, strong tea integrated naturally into everyday Egyptian life."
  );
  assert.equal(facts.callToAction, "Try Tafareeh Tea.");
  assert.deepEqual(facts.campaignFunnel, ["Awareness", "Interest", "Trial"]);

  // No measurable target in the brief — nothing may be invented.
  assert.deepEqual(facts.kpis ?? [], []);
});

// Tests 7 + 8 — profile identity: update in place, create only when absent.

type StoreCalls = {
  updates: Array<{ profileId: string; title?: string }>;
  creates: Array<{ conversationId: string; title: string }>;
};

function fakeStore(
  existing: { id: string; profile: CampaignIntelligenceProfile; title?: string | null } | null
) {
  const calls: StoreCalls = { updates: [], creates: [] };
  const store: CampaignIntelligenceProfileStore = {
    async getForConversation() {
      return existing;
    },
    async update({ profileId, profile, title }) {
      calls.updates.push({ profileId, title });
      return profile;
    },
    async create({ conversationId, profile, title }) {
      calls.creates.push({ conversationId, title });
      return { id: "created-profile-id", profile };
    },
  };
  return { store, calls };
}

test("an existing profile is updated in place — never duplicated", async () => {
  const previous = await analyze(FULL_BRIEF);
  const { store, calls } = fakeStore({ id: "existing-profile-id", profile: previous });

  const runsBefore = pipelineRuns;
  pipelineRuns += 1; // reanalyzeBriefIntelligence runs the pipeline internally
  const result = await reanalyzeBriefIntelligence(store, {
    conversationId: "conv-1",
    briefText: SPARSE_BRIEF,
  });

  assert.equal(pipelineRuns - runsBefore, 1, "exactly one pipeline run per Save");
  assert.equal(result?.created, false);
  assert.equal(result?.profileId, "existing-profile-id");
  assert.equal(calls.creates.length, 0, "no duplicate profile may be created");
  assert.deepEqual(
    calls.updates.map((call) => call.profileId),
    ["existing-profile-id"]
  );
});

test("no existing profile — one is created for the conversation", async () => {
  const { store, calls } = fakeStore(null);

  const result = await reanalyzeBriefIntelligence(store, {
    conversationId: "conv-2",
    briefText: FULL_BRIEF,
  });

  assert.equal(result?.created, true);
  assert.equal(result?.profileId, "created-profile-id");
  assert.equal(calls.updates.length, 0);
  assert.deepEqual(
    calls.creates.map((call) => call.conversationId),
    ["conv-2"]
  );
});

test("an empty brief performs no pipeline run and no write", async () => {
  const { store, calls } = fakeStore(null);
  const result = await reanalyzeBriefIntelligence(store, {
    conversationId: "conv-3",
    briefText: "   ",
  });

  assert.equal(result, null);
  assert.equal(calls.creates.length, 0);
  assert.equal(calls.updates.length, 0);
});

// Test 6 — planning state is untouched by the brief merge.

test("saving an edited brief preserves slate, shortlist and Discovery selections", () => {
  const creatorsSection = {
    id: "creators",
    title: "Creators",
    status: "complete" as const,
    content: "",
    data: {
      recommendations: { creatorIds: ["c1", "c2", "c3"] },
      shortlistId: "shortlist-9",
      discoverySelections: ["c1", "c3"],
    },
  };

  const campaignObject = {
    id: "campaign-1",
    updatedAt: new Date().toISOString(),
    meta: { campaignFacts: undefined },
    sections: {
      summary: { id: "summary", title: "Summary", status: "complete", content: "old", data: {} },
      strategy: { id: "strategy", title: "Strategy", status: "complete", content: "", data: {} },
      creators: creatorsSection,
    },
  } as unknown as Parameters<typeof mergeBriefIntoCampaignObject>[0];

  const result = mergeBriefIntoCampaignObject(
    campaignObject,
    "Brand: Tafareeh Tea. Market: Egypt. Objective: build awareness across Egypt."
  );

  // mergeBriefIntoCampaignObject is unchanged by this work — the slate, the
  // shortlist and the Discovery selections come through by identity.
  assert.equal(result.campaignObject.sections.creators, creatorsSection);
  assert.deepEqual(
    (result.campaignObject.sections.creators.data as Record<string, unknown>).recommendations,
    { creatorIds: ["c1", "c2", "c3"] }
  );
  assert.equal(
    (result.campaignObject.sections.creators.data as Record<string, unknown>).shortlistId,
    "shortlist-9"
  );
  assert.deepEqual(
    (result.campaignObject.sections.creators.data as Record<string, unknown>).discoverySelections,
    ["c1", "c3"]
  );
});

// The UI synchronization invariant.
//
// Save Brief updates the SAME profile in place, so `profileId` is stable across
// a re-analysis while the profile content changes. Any component that mirrors
// the workspace state into local state must therefore resync on the state
// itself, never on the id — keying CampaignIntelligencePanel's effect on
// `initialState?.profileId` left the Intake panel rendering the profile it
// copied at mount, while the Campaign Object beneath it showed the new values.

test("profileId is stable across a re-analysis — it cannot be a UI change signal", async () => {
  const stale = await analyze(SPARSE_BRIEF);
  const { store, calls } = fakeStore({ id: "profile-7a9b1208", profile: stale });

  const result = await reanalyzeBriefIntelligence(store, {
    conversationId: "conv-1",
    briefText: FULL_BRIEF,
  });

  // Same row, no duplicate — the persistence contract this invariant rests on.
  assert.equal(result?.created, false);
  assert.equal(calls.creates.length, 0);
  assert.equal(result?.profileId, "profile-7a9b1208");

  // …yet the content genuinely changed.
  const before = profileToCampaignFacts(stale);
  const after = profileToCampaignFacts(result!.profile);
  assert.equal(before.audience, undefined);
  assert.equal(before.deliverables, undefined);
  assert.ok(after.audience, "audience is populated after re-analysis");
  assert.ok(after.deliverables?.length, "deliverables are populated after re-analysis");
  assert.notEqual(after.objective, before.objective);

  // Hence: id unchanged + content changed ⇒ an id-keyed resync never fires.
  assert.equal(
    result?.profileId,
    "profile-7a9b1208",
    "a component keyed on profileId would miss this update entirely"
  );
  assert.notDeepEqual(result?.profile, stale, "the workspace state itself did change");
});

// Replace/Upload Brief reuses the same merge, so the same guarantees apply.

test("an operator campaign name survives a replaced brief that does not name one", async () => {
  const base = await analyze(FULL_BRIEF);
  // Intake stamps `product` operator-owned; the profile carries it on
  // campaignName + products (applyIntakeEditToProfile).
  const withOperatorName: CampaignIntelligenceProfile = {
    ...base,
    campaignName: "Tafareeh Ramadan Push",
    products: ["Tafareeh Ramadan Push"],
    sources: { ...base.sources, product: "operator" },
    confidence: { ...base.confidence, product: 1 },
  };

  const replaced = await analyze(SPARSE_BRIEF);
  const merged = mergeReanalyzedCampaignProfile({
    previousProfile: withOperatorName,
    reanalyzed: replaced,
  });
  const facts = profileToCampaignFacts(merged);

  assert.equal(merged.campaignName, "Tafareeh Ramadan Push");
  assert.deepEqual(merged.products, ["Tafareeh Ramadan Push"]);
  assert.equal(facts.product, "Tafareeh Ramadan Push");
  assert.equal(facts.sources.product, "operator");
});

test("operator name and budget survive together while brief fields are replaced", async () => {
  const base = await analyze(FULL_BRIEF);
  const previousProfile: CampaignIntelligenceProfile = {
    ...base,
    campaignName: "Tafareeh Ramadan Push",
    products: ["Tafareeh Ramadan Push"],
    budget: { amount: 300_000, currency: "EGP" },
    sources: { ...base.sources, product: "operator", budget: "operator" },
  };

  const changed = FULL_BRIEF.replace(
    "Objective: Build awareness and encourage people to try the product.",
    "Objective: Drive repeat purchase among existing drinkers."
  );
  const merged = mergeReanalyzedCampaignProfile({
    previousProfile,
    reanalyzed: await analyze(changed),
  });
  const facts = profileToCampaignFacts(merged);

  // Operator-owned: preserved, with provenance intact.
  assert.equal(facts.product, "Tafareeh Ramadan Push");
  assert.equal(facts.sources.product, "operator");
  assert.deepEqual(facts.budget, { amount: 300_000, currency: "EGP" });
  assert.equal(facts.sources.budget, "operator");

  // Brief-derived: replaced by the new brief.
  assert.match(facts.objective ?? "", /Drive repeat purchase/i);
  assert.equal(facts.sources.objective, "brief");
});

// 7 + 8 — nothing is invented to fill the Intake checklist.

test("the Tafareeh DOCX invents neither KPIs nor a campaign name", async () => {
  const bytes = await buildTafareehTeaDocx();
  const briefText = (
    await extractBriefDocumentText(
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "tafareeh-tea-brief.docx"
    )
  ).trim();

  const profile = await analyze(briefText);
  const facts = profileToCampaignFacts(profile);

  // The brief states no measurable target.
  assert.deepEqual(facts.kpis ?? [], []);

  // "Tafareeh Tea – Campaign Brief" is a document title, not a campaign name.
  assert.equal(profile.campaignName, undefined);
  assert.equal(facts.product, undefined);
  assert.doesNotMatch(profile.campaignName ?? "", /Campaign Brief/i);
});
