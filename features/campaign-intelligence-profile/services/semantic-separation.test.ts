import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCampaignIntelligenceProfileWithDebug } from "./extract-profile-llm";
import { normalizeFromProfile } from "./normalization";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { normalizeCampaignIntelligenceProfile } from "./normalize-profile";
import { mapCampaignIntelligenceToDiscoverySearch } from "./discovery-search-mapping";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";
import { fillBriefSourcedHeuristicGaps, buildLlmExtractionPrompts } from "./extract-profile-llm";
import { applyBriefSelections } from "@/lib/discovery/brief-search";
import { cloneCreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import { getTierFollowerRange } from "@/lib/creators/influencer-tier";

const hostedBrief = "Fixture Beauty campaign will run in Egypt. We need Egyptian Arabic-speaking Macro Beauty creators on Instagram with skincare content, targeting audiences in Saudi Arabia.";

// The hosted provider returned title-case Macro without a tier evidence excerpt.
// Exercise the real schema and pipeline, including persistence/reload and mapping.
for (const [brief, returnedTier, canonical] of [
  ["We need Celebrity creators.", "Celebrity", "celebrity"],
  ["We need Mega creators.", "Mega", "mega"],
  ["We need Macro creators.", "Macro", "macro"],
  ["We need Mid-Tier creators.", "Mid-Tier", "mid"],
  ["We need Micro creators.", "Micro", "micro"],
  ["We need Nano creators.", "Nano", "nano"],
  ["We need Egyptian Macro Beauty creators.", "Macro", "macro"],
  ["Macro creators targeting Saudi audiences.", "Macro", "macro"],
  ["Macro creators on Instagram.", "Macro", "macro"],
  ["Macro creators with engagement of at least 1%.", "Macro", "macro"],
  [hostedBrief, "Macro", "macro"],
  ["Macro creators.", "macro", "macro"],
  ["Macro creators.", "Macro Influencer", "macro"],
] as const) {
  test(`explicit tier survives schema, evidence, persistence and mapper: ${brief} / ${returnedTier}`, async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "fixture-only";
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ creatorRequirements: { tiers: [returnedTier] } }) } }] }));
    try {
      const extracted = await extractCampaignIntelligenceProfileWithDebug(brief);
      assert.equal(extracted.debug.heuristicFallback, false);
      assert.deepEqual(extracted.profile.creatorRequirements?.tiers, [returnedTier]);
      const { profile } = await runCampaignIntelligencePipeline({ briefText: brief, briefTextSource: "upload", profileExtractionAdapter: async () => extracted });
      const reloaded = normalizeCampaignIntelligenceProfile(JSON.stringify(profile));
      assert.deepEqual(reloaded.validatedIntelligence?.creator.tiers, [canonical]);
      assert.ok(reloaded.fieldProvenance?.["creatorRequirements.tiers"]?.excerpt?.includes("creators"));
      const selection = applyBriefSelections(reloaded, cloneCreatorSearchFilters(), {});
      const range = getTierFollowerRange(canonical);
      assert.deepEqual(selection.filters.followerRanges, [{ min: String(range.minFollowers), max: range.maxFollowers == null ? "" : String(range.maxFollowers) }]);
      assert.deepEqual(selection.filters.audienceCountries, []);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
  });
}

for (const [brief, returnedTier] of [
  ["Macro audiences are the target.", "Macro"],
  ["Campaign reach is 500000 people.", "Macro"],
  ["We do not need Macro creators.", "Macro"],
  ["We need Macro or Mega creators.", "Macro"],
  ["We need Macro creators.", "Mega"],
] as const) {
  test(`tier evidence recovery remains fail-closed: ${brief} / ${returnedTier}`, () => {
    const recovered = fillBriefSourcedHeuristicGaps({ ...createEmptyCampaignIntelligenceProfile(), creatorRequirements: { tiers: [returnedTier] } }, brief);
    assert.equal(recovered.fieldProvenance?.["creatorRequirements.tiers"], undefined);
    assert.deepEqual(normalizeFromProfile(recovered).validatedIntelligence.creator.tiers ?? [], []);
  });
}
test("hosted brief explicit evidence survives omitted model fields and persistence", async () => {
  const { profile } = await runCampaignIntelligencePipeline({ briefText: hostedBrief, briefTextSource: "upload", profileExtractionAdapter: async () => ({ profile: { ...createEmptyCampaignIntelligenceProfile(), market: "Egypt", platforms: ["instagram"], creatorCategories: ["Beauty"], sources: { geography: "brief", platforms: "brief", creatorCategories: "inferred" }, confidence: { geography: 0.85, platforms: 0.95, creatorCategories: 0.6 } }, debug: { systemPrompt: "fixture", userPrompt: hostedBrief, model: "fixture", rawResponse: "{}", heuristicFallback: false } }) });
  const persisted = normalizeCampaignIntelligenceProfile(JSON.stringify(profile));
  const v = persisted.validatedIntelligence!;
  assert.deepEqual(v.creator.countries, ["EG"]);
  assert.deepEqual(v.creator.languages, ["ar"]);
  assert.deepEqual(v.creator.tiers, ["macro"]);
  assert.deepEqual(v.categories, ["Beauty"]);
  assert.deepEqual(v.platforms, ["instagram"]);
  assert.deepEqual(v.keywords, ["skincare"]);
  assert.deepEqual(v.audience.countries, ["SA"]);
  assert.equal(v.market.countryCode, "EG");
  const selection = applyBriefSelections(persisted, cloneCreatorSearchFilters(), {});
  assert.deepEqual(selection.filters.categories, ["Beauty"]);
  assert.deepEqual(selection.filters.countries, ["EG"]);
  assert.deepEqual(selection.filters.audienceCountries, []);
  assert.ok(selection.requirements.some(r => r.classification === "UNSUPPORTED" && r.value === "SA"));
});

for (const text of ["Campaign in Egypt for Arabic audiences.", "We do not need Egyptian Macro Beauty creators.", "We need Egyptian or Saudi creators.", "We need creators on Instagram in Egypt.", "We need non-Egyptian creators.", "We need creators targeting audiences in Saudi Arabia."]) {
  test(`explicit recovery fails closed: ${text}`, () => {
    const p = fillBriefSourcedHeuristicGaps(createEmptyCampaignIntelligenceProfile(), text);
    assert.deepEqual(p.creatorRequirements?.countries ?? [], []);
    assert.deepEqual(p.creatorRequirements?.languages ?? [], []);
  });
}
test("provider request includes the actual nested extraction schema", () => {
  const prompt = buildLlmExtractionPrompts(hostedBrief).systemPrompt;
  assert.ok(prompt.includes('"creatorRequirements"'));
  assert.ok(prompt.includes('"audienceDetail"'));
  assert.ok(prompt.includes('"evidenceExcerpts"'));
});

test("safe QA brief facts also survive the existing no-provider fallback", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const { profile, pipelineDebug } = await runCampaignIntelligencePipeline({ briefText: hostedBrief, briefTextSource: "upload" });
    assert.equal(pipelineDebug.heuristicFallback, true);
    const v = profile.validatedIntelligence!;
    assert.deepEqual(v.creator.countries, ["EG"]);
    assert.deepEqual(v.creator.languages, ["ar"]);
    assert.deepEqual(v.creator.tiers, ["macro"]);
    assert.deepEqual(v.categories, ["Beauty"]);
    assert.deepEqual(v.keywords, ["skincare"]);
    assert.deepEqual(v.audience.countries, ["SA"]);
    assert.equal(v.market.countryCode, "EG");
  } finally {
    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey;
  }
});

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
