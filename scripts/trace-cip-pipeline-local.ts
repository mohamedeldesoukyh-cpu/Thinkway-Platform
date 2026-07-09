/**
 * Local CIP pipeline trace (no Supabase) — simulates L'Oréal Premium Skincare brief.
 * Usage: npx tsx scripts/trace-cip-pipeline-local.ts
 */
import { extractCampaignIntelligenceProfile } from "../features/campaign-intelligence-profile/services/extract-profile-llm";
import { mapCampaignIntelligenceToDiscoverySearch } from "../features/campaign-intelligence-profile/services/discovery-search-mapping/map-campaign-intelligence";
import { profileToDiscoveryRequirements } from "../features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import {
  normalizeCampaignIntelligence,
  normalizeFromProfile,
  buildEvidenceReviewRows,
} from "../features/campaign-intelligence-profile/services/normalization";
import { validateNormalizedEvidence } from "../features/campaign-intelligence-profile/services/normalization/validate-normalized-evidence";
import { normalizeCampaignIntelligenceProfile } from "../features/campaign-intelligence-profile/services/normalize-profile";

/** Simulates mammoth/docx table extraction with adjacent-field concatenation (observed failure mode). */
const SIMULATED_PARSED_TEXT = `
L'Oréal Premium Skincare Campaign Brief

Client / Brand Name : L'Oréal ParisMarket : Egypt
Campaign Name : Vitamin C Serum Launch
Campaign Country : EgyptCampaign Duration : 5 weeks
Campaign Objectives : Engagement, UGC, Brand awareness
Social Platforms : Instagram, TikTok
Creator Type Preferences : Beauty, skincare specialists, micro-influencers, 20k-500k followers
Audience Preferences : Women 25–40 interested in premium skincare
Content Keywords : vitamin c, serum, brightening, anti-aging
Deliverables : Reels, Stories, UGC posts
Budget : EUR 600,000
KPIs : Engagement rate 3%, Reach 2M
`.trim();

function section(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function printJson(label: string, value: unknown) {
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  section("1. RAW EXTRACTED DOCUMENT TEXT (simulated docx/mammoth output)");
  console.log(SIMULATED_PARSED_TEXT);
  console.log("\nKey substrings:");
  console.log("  ParisMarket:", SIMULATED_PARSED_TEXT.includes("ParisMarket"));
  console.log("  Market : Egypt:", SIMULATED_PARSED_TEXT.includes("Market : Egypt"));
  console.log("  EgyptCampaign Duration:", SIMULATED_PARSED_TEXT.includes("EgyptCampaign Duration"));

  section("2. LLM / HEURISTIC EXTRACTION JSON");
  const extracted = await extractCampaignIntelligenceProfile(SIMULATED_PARSED_TEXT);
  printJson("extractCampaignIntelligenceProfile output", extracted);

  section("3. NORMALIZATION");
  const normalized = normalizeCampaignIntelligence(extracted);
  printJson("normalizedEntities", normalized.normalizedEntities);
  printJson("extractionIssues (normalize)", normalized.extractionIssues);

  section("4. VALIDATION");
  const extractedWithExcerpt = {
    ...extracted,
    rawBriefExcerpt: SIMULATED_PARSED_TEXT.slice(0, 500),
  };
  const validated = validateNormalizedEvidence(
    extractedWithExcerpt,
    normalized.normalizedEntities,
    normalized.extractionIssues
  );
  printJson("validated.normalizedEntities", validated.normalizedEntities);
  printJson("validated.extractionIssues", validated.extractionIssues);

  const report = {
    accepted: buildEvidenceReviewRows(validated.normalizedEntities),
    rejected: validated.extractionIssues,
  };
  printJson("validation report", report);

  section("5. FULL UPLOAD PIPELINE (normalizeFromProfile)");
  const piped = normalizeFromProfile({
    ...extracted,
    rawBriefExcerpt: SIMULATED_PARSED_TEXT.slice(0, 500),
  });
  printJson("persisted-equivalent profile", piped.profile);

  section("6. LOAD-TIME RE-NORMALIZATION (normalizeCampaignIntelligenceProfile)");
  const asPersisted = piped.profile;
  const loadTime = normalizeCampaignIntelligenceProfile(asPersisted);
  printJson("load-time profile", loadTime);

  section("7. DISCOVERY MAPPING");
  printJson("mapping input.normalizedEntities", loadTime.normalizedEntities);
  const mapping = mapCampaignIntelligenceToDiscoverySearch(loadTime);
  printJson("mapping output", mapping);

  section("8. UI PROPS — Discovery Requirements panel");
  const uiRequirements = profileToDiscoveryRequirements(loadTime);
  printJson("CampaignRequirementsForm.value", uiRequirements);
  printJson("CampaignRequirementsForm.baseProfile (subset)", {
    brandName: loadTime.brandName,
    market: loadTime.market,
    geography: loadTime.geography,
    normalizedEntities: loadTime.normalizedEntities,
    extractionIssues: loadTime.extractionIssues,
    fieldProvenance: loadTime.fieldProvenance,
    rawBriefExcerpt: loadTime.rawBriefExcerpt,
  });
}

main().catch(console.error);
