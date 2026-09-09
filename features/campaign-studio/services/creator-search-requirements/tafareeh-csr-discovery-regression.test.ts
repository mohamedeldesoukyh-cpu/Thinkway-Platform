/**
 * Tafareeh Tea — Phase 2 end-to-end regression.
 *
 * Runs the real path a real brief takes: DOCX bytes → canonical document
 * extraction → the campaign intelligence pipeline → Campaign Facts → the
 * bootstrap Director-SSOT strategy document → CSR → the CSR/CIP filter merge.
 * Nothing is stubbed except the workflow engine's own plumbing, which
 * `csr-search-wiring.test.ts` covers.
 *
 * Known brief facts: Egypt · Food creators · Instagram + TikTok · 2 weeks ·
 * Egyptian tea drinkers, mainly young adults and families · awareness / trial ·
 * Reel + Story mirrored to TikTok. Campaign name and budget are entered by the
 * operator; the brief states no KPIs. Nothing beyond that may be asserted, and
 * nothing beyond that may be invented.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import { runCampaignIntelligencePipeline } from "@/features/campaign-intelligence-profile/services/run-intelligence-pipeline";
import { extractBriefDocumentText } from "@/features/campaign-intelligence-profile/services/brief-document-parser";
import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import { buildTafareehTeaDocx } from "@/features/campaign-intelligence-profile/fixtures/build-tafareeh-docx";
import { writeStrategyDocumentFromBrief } from "@/features/campaign-director/services/strategy-document";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import { buildPreSearchCreatorSearchRequirements } from "./attach-creator-search-requirements";
import { mergeCsrFiltersIntoDiscoveryFilters } from "./merge-csr-into-discovery-filters";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type TafareehRun = {
  profile: CampaignIntelligenceProfile;
  facts: CampaignFacts;
  cipFilters: ReturnType<typeof mapCampaignIntelligenceToDiscoverySearch>["filters"];
  merged: ReturnType<typeof mergeCsrFiltersIntoDiscoveryFilters>;
  requirements: ReturnType<typeof buildPreSearchCreatorSearchRequirements>;
};

/** The production chain, from DOCX bytes to the filters that reach Discovery. */
async function runTafareeh(): Promise<TafareehRun> {
  const bytes = await buildTafareehTeaDocx();
  const briefText = (await extractBriefDocumentText(bytes, DOCX_MIME, "tafareeh.docx")).trim();

  const { profile: extracted } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
  });
  const profile = { ...extracted, schemaVersion: 1, status: "saved" } as CampaignIntelligenceProfile;
  const facts = profileToCampaignFacts(profile);

  // The engine's bootstrap strategy document — the pre-search CSR's source.
  const strategy = writeStrategyDocumentFromBrief(
    { rawMessage: profile.rawBriefExcerpt ?? briefText, brandName: facts.brandName, campaignFacts: facts },
    facts
  );

  const requirements = buildPreSearchCreatorSearchRequirements({
    campaignStrategyDocument: strategy,
    validatedCampaignIntelligence: profile.validatedIntelligence,
    campaignFacts: facts,
    campaignIntelligenceProfileId: "tafareeh-profile",
  });

  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profile).filters;
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: cipFilters, requirements });

  return { profile, facts, cipFilters, merged, requirements };
}

test("Tafareeh: CSR is generated from the brief and reaches the live filter set", async () => {
  const { requirements, merged } = await runTafareeh();

  assert.equal(requirements.campaignIntelligenceProfileId, "tafareeh-profile");
  assert.ok(requirements.strategyRef, "CSR must be tied to the strategy revision it came from");
  assert.ok(
    !requirements.gaps.some((gap) => gap.blocking),
    `Tafareeh must not produce a blocking gap: ${JSON.stringify(requirements.gaps)}`
  );
  assert.ok(merged.filters.length > 0);
});

test("Tafareeh: every CIP filter Discovery uses today survives the merge", async () => {
  const { cipFilters, merged } = await runTafareeh();

  const mergedIdentities = new Set(
    merged.filters.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`)
  );
  for (const filter of cipFilters) {
    assert.ok(
      mergedIdentities.has(`${filter.key}:${filter.value.trim().toLowerCase()}`),
      `CIP filter ${filter.key}:${filter.value} was lost`
    );
  }
  assert.ok(merged.filters.length >= cipFilters.length);
});

test("Tafareeh: the known brief facts are the ones that reach Discovery", async () => {
  const { merged } = await runTafareeh();
  const values = merged.filters.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`);

  assert.ok(
    values.includes("audience_country:eg") || values.includes("creator_country:eg"),
    "Egypt must reach Discovery"
  );
  assert.ok(values.includes("category:food"), "Food creator category must reach Discovery");
  assert.ok(values.includes("platform:instagram"), "Instagram must reach Discovery");
  assert.ok(values.includes("platform:tiktok"), "TikTok must reach Discovery");
});

test("Tafareeh: nothing outside the brief is invented on the way to Discovery", async () => {
  const { profile, facts, merged } = await runTafareeh();

  // Campaign name and budget are operator-entered — never extracted.
  assert.equal(profile.campaignName, undefined);
  assert.equal(facts.product, undefined);
  assert.equal(facts.budget, undefined);

  // The brief states no KPIs.
  assert.deepEqual(facts.kpis ?? [], []);

  // Industry stays the display-safe label, not the internal enum value.
  assert.equal(facts.industry, "Brand Campaign");

  // Duration and audience are campaign facts, not search filters.
  assert.equal(facts.durationWeeks, 2);
  const haystack = merged.filters.map((f) => `${f.key} ${f.label} ${f.value}`).join(" ").toLowerCase();
  assert.ok(!haystack.includes("2 weeks"));
  assert.ok(!haystack.includes("brand campaign"));
});

test("Tafareeh: no budget anywhere, and Discovery is reached regardless", async () => {
  const { facts, requirements, merged } = await runTafareeh();

  assert.equal(facts.budget, undefined, "the brief states no budget");
  assert.equal(requirements.strategic.budget, undefined);
  assert.ok(
    !requirements.gaps.some((gap) => /budget/i.test(gap.field) || /budget/i.test(gap.reason)),
    "a missing budget must never be recorded as a CSR gap"
  );

  const haystack = merged.filters.map((f) => `${f.key} ${f.label} ${f.value}`).join(" ").toLowerCase();
  for (const marker of ["budget", "egp", "price", "cost"]) {
    assert.ok(!haystack.includes(marker), `"${marker}" must not appear in a Discovery filter`);
  }
  assert.ok(merged.filters.length > 0, "a budget-less brief must still reach live Discovery");
});
