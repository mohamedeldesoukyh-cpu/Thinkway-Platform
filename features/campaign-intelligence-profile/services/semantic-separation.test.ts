import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCampaignIntelligenceProfileWithDebug } from "./extract-profile-llm";
import { normalizeFromProfile } from "./normalization";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { normalizeCampaignIntelligenceProfile } from "./normalize-profile";
import { mapCampaignIntelligenceToDiscoverySearch } from "./discovery-search-mapping";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";

// Recorded responses exercise the real existing extraction -> normalization -> mapper.
// No provider calls; these prove contract behavior, not unconstrained LLM accuracy.
const fixtures = [
  { text: "Target audience is in Egypt.", data: { audienceDetail: { countries: ["EG"] } }, creator: [], audience: ["EG"] },
  { text: "Campaign will run in Egypt.", data: { market: "Egypt" }, creator: [], audience: [], market: "EG" },
  { text: "We need Egyptian creators.", data: { creatorRequirements: { countries: ["EG"] } }, creator: ["EG"], audience: [] },
  { text: "We need Egyptian creators targeting audiences in Saudi Arabia.", data: { creatorRequirements: { countries: ["EG"] }, audienceDetail: { countries: ["SA"] } }, creator: ["EG"], audience: ["SA"] },
  { text: "Arabic-speaking creators.", data: { creatorRequirements: { languages: ["ar"] } }, creator: [], audience: [], language: ["ar"] },
  { text: "Content should be in Arabic.", data: { contentLanguages: ["ar"] }, creator: [], audience: [], content: ["ar"] },
  { text: "Arabic-speaking audience.", data: { audienceDetail: { languages: ["ar"] } }, creator: [], audience: [], audienceLanguage: ["ar"] },
  { text: "Female creators targeting women.", data: { creatorRequirements: { gender: "female" }, audienceDetail: { gender: "female" } }, creator: [], audience: [], gender: "female" },
  { text: "Macro beauty creators on Instagram in Egypt. Location scope is unspecified.", data: { creatorRequirements: { tiers: ["macro"] }, creatorCategories: ["Beauty"], platforms: ["instagram"], requirements: { mandatory: ["Location scope needs review"] } }, creator: [], audience: [] },
  { text: "Egypt campaign targeting Egyptian consumers using macro beauty creators.", data: { market: "Egypt", audienceDetail: { countries: ["EG"] }, creatorRequirements: { tiers: ["macro"] }, creatorCategories: ["Beauty"] }, creator: [], audience: ["EG"], market: "EG" },
  { text: "Egyptian macro beauty creators for an Egypt campaign.", data: { market: "Egypt", creatorRequirements: { countries: ["EG"], tiers: ["macro"] }, creatorCategories: ["Beauty"] }, creator: ["EG"], audience: [], market: "EG" },
  { text: "Instagram beauty campaign. No creator country specified.", data: { platforms: ["instagram"], creatorCategories: ["Beauty"] }, creator: [], audience: [] },
];

for (const fixture of fixtures) test(fixture.text, async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "fixture-only";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const evidenceExcerpts = Object.fromEntries(["market", "audienceDetail.countries", "audienceDetail.languages", "audienceDetail.gender", "creatorRequirements.countries", "creatorRequirements.languages", "creatorRequirements.gender", "creatorRequirements.tiers", "contentLanguages"].map(k => [k, fixture.text]));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...fixture.data, evidenceExcerpts }) } }] }));
  };
  try {
    const extracted = await extractCampaignIntelligenceProfileWithDebug(fixture.text);
    assert.equal(extracted.debug.heuristicFallback, false);
    const { profile } = await runCampaignIntelligencePipeline({ briefText: fixture.text, briefTextSource: "upload", profileExtractionAdapter: async () => extracted });
    const v = profile.validatedIntelligence!;
    assert.deepEqual(v.creator.countries ?? [], fixture.creator);
    assert.deepEqual(v.audience.countries, fixture.audience);
    assert.deepEqual(v.creator.languages ?? [], "language" in fixture ? fixture.language : []);
    assert.deepEqual(v.creator.contentLanguages ?? [], "content" in fixture ? fixture.content : []);
    assert.deepEqual(v.audience.languages, "audienceLanguage" in fixture ? fixture.audienceLanguage : []);
    assert.equal(v.market.countryCode, "market" in fixture ? fixture.market : undefined);
    if ("gender" in fixture) { assert.equal(v.creator.gender, "female"); assert.equal(v.audience.gender, "female"); }
    const mapped = mapCampaignIntelligenceToDiscoverySearch(profile);
    assert.deepEqual(mapped.filters.filter(f => f.key === "creator_country").map(f => f.value), fixture.creator);
    assert.ok(!mapped.filters.some(f => f.key.startsWith("audience") || f.key === "creator_gender"));
    assert.equal(calls, 1);
    if (fixture.creator.length) assert.equal(v.fieldEvidence["creator.countries"].excerpt, fixture.text);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("old stored CIPs load without inventing creator requirements", () => {
  const profile = normalizeCampaignIntelligenceProfile(JSON.stringify({ ...createEmptyCampaignIntelligenceProfile(), market: "Egypt", audienceDetail: { countries: ["EG"] } }));
  assert.deepEqual(profile.validatedIntelligence?.creator.countries ?? [], []);
  assert.ok(!mapCampaignIntelligenceToDiscoverySearch(profile).filters.some(f => f.key === "creator_country"));
});

test("new creator values without their own evidence fail closed", () => {
  const { profile } = normalizeFromProfile({ ...createEmptyCampaignIntelligenceProfile(), market: "Egypt", creatorRequirements: { countries: ["EG"], languages: ["ar"] } });
  assert.deepEqual(profile.validatedIntelligence?.creator.countries ?? [], []);
  assert.equal(profile.extractionIssues?.length, 2);
});
