/**
 * Replace/Upload Brief → Campaign Object facts synchronization.
 *
 * Intake renders two halves from two stores: the upper Campaign Intelligence
 * panel reads the CIP profile, the lower "What Thinkway understood" reads
 * `mergeIntakeDisplayFacts(objectFacts, cipFacts)` — which prefers
 * `campaignObject.meta.campaignFacts`. Replacing a brief updated only the
 * profile, so the two halves disagreed until a reload.
 *
 * The upload now writes the merged profile's facts onto the Campaign Object
 * through `applyConfirmedCampaignFactsToCampaignObject`, the established facts
 * writer. `mergeBriefIntoCampaignObject` is untouched and stays pure and sync.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { mergeIntakeDisplayFacts } from "@/features/campaign-studio/services/studio-intake-facts";
import { mergeReanalyzedCampaignProfile } from "@/features/campaign-studio/services/reanalyze-campaign-brief";

import { buildTafareehTeaDocx } from "../fixtures/build-tafareeh-docx";
import { extractBriefDocumentText } from "./brief-document-parser";
import { applyConfirmedCampaignFactsToCampaignObject } from "./campaign-facts-spine";
import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import type { CampaignIntelligenceProfile } from "../types/profile";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SPARSE_BRIEF = ["Brand: Tafareeh Tea", "", "Market: Egypt", "", "Duration: 2 weeks"].join(
  "\n"
);

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

async function analyze(briefText: string): Promise<CampaignIntelligenceProfile> {
  const { profile } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
  });
  return { ...profile, schemaVersion: 1, status: "saved" };
}

/** The slate, shortlist and Discovery selections that must survive untouched. */
const CREATORS_SECTION = {
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

function campaignObjectWith(facts?: unknown): CampaignObject {
  return {
    id: "campaign-1",
    conversationId: "conv-1",
    updatedAt: new Date().toISOString(),
    meta: facts ? { campaignFacts: facts } : {},
    sections: {
      summary: { id: "summary", title: "Summary", status: "complete", content: "", data: {} },
      strategy: { id: "strategy", title: "Strategy", status: "complete", content: "", data: {} },
      timeline: { id: "timeline", title: "Timeline", status: "complete", content: "", data: {} },
      creators: CREATORS_SECTION,
    },
  } as unknown as CampaignObject;
}

/** Mirrors the action: merge operator values, then write facts onto the object. */
async function replaceBrief(input: {
  briefText: string;
  previousProfile?: CampaignIntelligenceProfile | null;
  campaignObject: CampaignObject;
}) {
  const reanalyzed = await analyze(input.briefText);
  const merged = mergeReanalyzedCampaignProfile({
    previousProfile: input.previousProfile,
    previousFacts: getCampaignFacts(input.campaignObject),
    reanalyzed,
  });
  const facts = profileToCampaignFacts(merged);
  const nextObject = applyConfirmedCampaignFactsToCampaignObject(input.campaignObject, facts);
  return { profile: merged, facts, campaignObject: nextObject };
}

// 1 + 2 — the object's facts are updated, and both halves agree.

test("replacing a brief writes the merged facts onto the Campaign Object", async () => {
  const stale = await analyze(SPARSE_BRIEF);
  const before = campaignObjectWith(profileToCampaignFacts(stale));
  assert.equal(getCampaignFacts(before)?.audience, undefined);

  const { campaignObject } = await replaceBrief({
    briefText: FULL_BRIEF,
    previousProfile: stale,
    campaignObject: before,
  });

  const objectFacts = getCampaignFacts(campaignObject);
  assert.match(objectFacts?.objective ?? "", /Build awareness and encourage people to try/i);
  assert.equal(objectFacts?.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.deepEqual(objectFacts?.deliverables, ["1 Instagram Reel", "1 Instagram Story"]);
});

test("upper (profile) and lower (object facts) resolve to the same canonical values", async () => {
  const bytes = await buildTafareehTeaDocx();
  const briefText = (
    await extractBriefDocumentText(bytes, DOCX_MIME, "tafareeh.docx")
  ).trim();

  const { profile, campaignObject } = await replaceBrief({
    briefText,
    previousProfile: await analyze(SPARSE_BRIEF),
    campaignObject: campaignObjectWith(),
  });

  const upper = profileToCampaignFacts(profile);
  const lower = mergeIntakeDisplayFacts(getCampaignFacts(campaignObject), upper);

  for (const field of [
    "objective",
    "audience",
    "durationWeeks",
    "industry",
    "campaignType",
  ] as const) {
    assert.deepEqual(lower?.[field], upper[field], `${field} must agree across both panels`);
  }
  assert.deepEqual(lower?.deliverables, upper.deliverables);
  assert.deepEqual(lower?.geography, upper.geography);
  assert.deepEqual(lower?.creatorCategories, upper.creatorCategories);
  assert.deepEqual(lower?.creatorCategories, ["Food"]);
});

// 3 — a brief-derived value the new brief drops disappears from the object too.

test("a removed brief-derived field disappears from campaignFacts", async () => {
  const full = await analyze(FULL_BRIEF);
  const before = campaignObjectWith(profileToCampaignFacts(full));
  assert.ok(getCampaignFacts(before)?.audience);

  const { campaignObject } = await replaceBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: full,
    campaignObject: before,
  });

  const objectFacts = getCampaignFacts(campaignObject);
  assert.equal(objectFacts?.audience, undefined, "stale audience must not survive on the object");
  assert.equal(objectFacts?.deliverables, undefined, "stale deliverables must not survive");
});

// 4 + 5 — operator values survive into the object's facts.

test("an operator budget survives into campaignFacts", async () => {
  const base = await analyze(FULL_BRIEF);
  const withBudget: CampaignIntelligenceProfile = {
    ...base,
    budget: { amount: 750_000, currency: "EGP" },
    sources: { ...base.sources, budget: "operator" },
  };

  const { campaignObject } = await replaceBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: withBudget,
    campaignObject: campaignObjectWith(profileToCampaignFacts(withBudget)),
  });

  const objectFacts = getCampaignFacts(campaignObject);
  assert.deepEqual(objectFacts?.budget, { amount: 750_000, currency: "EGP" });
  assert.equal(objectFacts?.sources.budget, "operator");
});

test("an operator campaign name survives into campaignFacts", async () => {
  const base = await analyze(FULL_BRIEF);
  const withName: CampaignIntelligenceProfile = {
    ...base,
    campaignName: "Tafareeh Ramadan Push",
    products: ["Tafareeh Ramadan Push"],
    sources: { ...base.sources, product: "operator" },
  };

  const { campaignObject } = await replaceBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: withName,
    campaignObject: campaignObjectWith(profileToCampaignFacts(withName)),
  });

  const objectFacts = getCampaignFacts(campaignObject);
  assert.equal(objectFacts?.product, "Tafareeh Ramadan Push");
  assert.equal(objectFacts?.sources.product, "operator");
});

test("an operator value known only to the Campaign Object also survives", async () => {
  const base = await analyze(FULL_BRIEF);
  const objectFacts = {
    ...profileToCampaignFacts(base),
    budget: { amount: 250_000, currency: "EGP" },
    sources: { ...profileToCampaignFacts(base).sources, budget: "operator" as const },
  };

  const { campaignObject } = await replaceBrief({
    briefText: SPARSE_BRIEF,
    previousProfile: { ...base, budget: { amount: 250_000, currency: "EGP" } },
    campaignObject: campaignObjectWith(objectFacts),
  });

  assert.deepEqual(getCampaignFacts(campaignObject)?.budget, {
    amount: 250_000,
    currency: "EGP",
  });
  assert.equal(getCampaignFacts(campaignObject)?.sources.budget, "operator");
});

// 6 — the slate and every unrelated section are untouched.

test("the creator slate, shortlist and Discovery selections are untouched", async () => {
  const before = campaignObjectWith();
  const { campaignObject } = await replaceBrief({
    briefText: FULL_BRIEF,
    previousProfile: null,
    campaignObject: before,
  });

  // Same object reference — the facts writer spreads sections and never
  // rebuilds creators.
  assert.equal(campaignObject.sections.creators, CREATORS_SECTION);
  const data = campaignObject.sections.creators.data as Record<string, unknown>;
  assert.deepEqual(data.recommendations, { creatorIds: ["c1", "c2", "c3"] });
  assert.equal(data.shortlistId, "shortlist-9");
  assert.deepEqual(data.discoverySelections, ["c1", "c3"]);
  assert.equal(campaignObject.sections.strategy, before.sections.strategy);
});

// 8 + 9 + 10 — nothing invented, industry display-safe.

test("the Tafareeh replacement invents no KPIs and no campaign name, and stays display-safe", async () => {
  const bytes = await buildTafareehTeaDocx();
  const briefText = (
    await extractBriefDocumentText(bytes, DOCX_MIME, "tafareeh.docx")
  ).trim();

  const { profile, campaignObject } = await replaceBrief({
    briefText,
    previousProfile: null,
    campaignObject: campaignObjectWith(),
  });
  const objectFacts = getCampaignFacts(campaignObject);

  assert.deepEqual(objectFacts?.kpis ?? [], []);
  assert.equal(profile.campaignName, undefined);
  assert.equal(objectFacts?.product, undefined);
  assert.equal(objectFacts?.industry, "Brand Campaign");
  assert.notEqual(objectFacts?.industry, "general");
});
