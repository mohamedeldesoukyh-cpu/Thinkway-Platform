/**
 * Read-only Campaign Intelligence pipeline trace.
 * Usage: npx tsx scripts/trace-cip-pipeline.ts [profileId]
 */
import { createClient } from "@supabase/supabase-js";

import { extractCampaignIntelligenceProfileWithDebug } from "../features/campaign-intelligence-profile/services/extract-profile-llm";
import { mapCampaignIntelligenceToDiscoverySearch } from "../features/campaign-intelligence-profile/services/discovery-search-mapping/map-campaign-intelligence";
import { profileToDiscoveryRequirements } from "../features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import {
  normalizeCampaignIntelligence,
  normalizeFromProfile,
  buildEvidenceReviewRows,
} from "../features/campaign-intelligence-profile/services/normalization";
import { validateNormalizedEvidence } from "../features/campaign-intelligence-profile/services/normalization/validate-normalized-evidence";
import { normalizeCampaignIntelligenceProfile } from "../features/campaign-intelligence-profile/services/normalize-profile";
import { resolveBriefTextForExtraction } from "../features/campaign-intelligence-profile/services/resolve-brief-text";
import type { CampaignIntelligenceProfile } from "../features/campaign-intelligence-profile/types/profile";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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
  const profileIdArg = process.argv[2]?.trim();

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  let profileRow: {
    id: string;
    title: string | null;
    profile: unknown;
    source_document_id: string | null;
    created_at: string;
    updated_at: string;
  } | null = null;

  if (profileIdArg) {
    const { data, error } = await supabase
      .from("campaign_intelligence_profiles")
      .select("id, title, profile, source_document_id, created_at, updated_at")
      .eq("id", profileIdArg)
      .maybeSingle();
    if (error) throw error;
    profileRow = data;
  } else {
    const { data, error } = await supabase
      .from("campaign_intelligence_profiles")
      .select("id, title, profile, source_document_id, created_at, updated_at")
      .or("title.ilike.%loreal%,title.ilike.%loréal%,title.ilike.%Loreal%")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    profileRow = data;

    if (!profileRow) {
      const { data: latest, error: latestErr } = await supabase
        .from("campaign_intelligence_profiles")
        .select("id, title, profile, source_document_id, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestErr) throw latestErr;
      profileRow = latest;
    }
  }

  if (!profileRow) {
    console.error("No campaign intelligence profile found in Supabase.");
    process.exit(1);
  }

  section("0. SUPABASE RECORD (persisted)");
  console.log("profileId:", profileRow.id);
  console.log("title:", profileRow.title);
  console.log("updated_at:", profileRow.updated_at);
  printJson("persisted.profile (raw jsonb)", profileRow.profile);

  let parsedText: string | null = null;
  let llmBriefText: string | null = null;
  let fileName: string | null = null;
  if (profileRow.source_document_id) {
    const { data: doc, error: docErr } = await supabase
      .from("campaign_intelligence_documents")
      .select("file_name, parsed_text, llm_brief_text, structured_document, mime_type, parse_status")
      .eq("id", profileRow.source_document_id)
      .maybeSingle();
    if (docErr) throw docErr;
    parsedText = doc?.parsed_text ?? null;
    llmBriefText = doc?.llm_brief_text ?? null;
    fileName = doc?.file_name ?? null;

    section("1. RAW EXTRACTED DOCUMENT TEXT");
    console.log("fileName:", fileName);
    console.log("mime:", doc?.mime_type);
    console.log("parse_status:", doc?.parse_status);
    console.log("parsed_text length:", parsedText?.length ?? 0);
    console.log("llm_brief_text length:", llmBriefText?.length ?? 0);
    printJson("structured_document", doc?.structured_document ?? null);
    if (parsedText) {
      console.log("\n--- parsed_text (first 1500 chars) ---");
      console.log(parsedText.slice(0, 1500));
      if (parsedText.length > 1500) console.log("\n... [truncated for console] ...");
    }
    if (llmBriefText) {
      console.log("\n--- llm_brief_text (first 1500 chars) ---");
      console.log(llmBriefText.slice(0, 1500));
      if (llmBriefText.length > 1500) console.log("\n... [truncated for console] ...");
    }
  } else {
    section("1. RAW EXTRACTED DOCUMENT TEXT");
    console.log("No source_document_id on profile.");
  }

  const persisted = normalizeCampaignIntelligenceProfile(profileRow.profile);

  const resolved = resolveBriefTextForExtraction({
    profile: persisted,
    document: { parsed_text: parsedText, llm_brief_text: llmBriefText },
  });

  section("1b. BRIEF TEXT RESOLUTION (re-analyze path)");
  console.log("source:", resolved.source);
  console.log("text length:", resolved.text.length);

  section("2. RE-RUN LLM EXTRACTION (structured text when available)");
  let llmJson: CampaignIntelligenceProfile | null = null;
  let llmDebug: Awaited<ReturnType<typeof extractCampaignIntelligenceProfileWithDebug>>["debug"] | null =
    null;
  if (resolved.text.trim()) {
    const extracted = await extractCampaignIntelligenceProfileWithDebug(resolved.text);
    llmJson = extracted.profile;
    llmDebug = extracted.debug;
    printJson("LLM extraction output (CampaignIntelligenceProfile)", llmJson);
    printJson("LLM prompt", {
      system: llmDebug.systemPrompt,
      user: llmDebug.userPrompt,
      model: llmDebug.model,
    });
    printJson("raw LLM response", llmDebug.rawResponse);
  } else {
    console.log("Skipped — no brief text.");
  }

  printJson("persisted.pipelineDebug", persisted.pipelineDebug);

  section("3. NORMALIZATION (normalizeCampaignIntelligence on persisted profile)");
  const preNorm = normalizeCampaignIntelligence(persisted);
  printJson("normalizedEntities", preNorm.normalizedEntities);
  printJson("extractionIssues (post-normalize)", preNorm.extractionIssues);

  section("4. VALIDATION (validateNormalizedEvidence)");
  const validated = validateNormalizedEvidence(
    persisted,
    preNorm.normalizedEntities,
    preNorm.extractionIssues
  );
  printJson("validated.normalizedEntities", validated.normalizedEntities);
  printJson("validated.extractionIssues", validated.extractionIssues);

  const validationReport = {
    accepted: buildEvidenceReviewRows(validated.normalizedEntities),
    rejected: validated.extractionIssues.map((i) => ({
      field: i.field,
      rawValue: i.rawValue,
      reason: i.reason,
      kind: i.kind,
      severity: i.severity,
    })),
  };
  printJson("validation report", validationReport);

  section("5. FULL PIPELINE (normalizeFromProfile — upload-time equivalent)");
  const sourceForPipeline = llmJson ?? persisted;
  const piped = normalizeFromProfile(sourceForPipeline);
  printJson("normalizeFromProfile.profile", piped.profile);

  section("6. LOAD-TIME RE-NORMALIZATION (normalizeCampaignIntelligenceProfile)");
  const loadTimeProfile = normalizeCampaignIntelligenceProfile(profileRow.profile);
  printJson("load-time profile (what buildWorkspaceState returns)", loadTimeProfile);

  section("7. DISCOVERY MAPPING");
  const mappingInput = loadTimeProfile;
  printJson("mapping input (normalizedEntities)", mappingInput.normalizedEntities);
  const mapping = mapCampaignIntelligenceToDiscoverySearch(mappingInput);
  printJson("mapping output", mapping);

  section("8. UI PROPS — Discovery Requirements panel");
  const uiRequirements = profileToDiscoveryRequirements(loadTimeProfile);
  const uiProps = {
    CampaignRequirementsForm: {
      value: uiRequirements,
      baseProfile: {
        brandName: loadTimeProfile.brandName,
        normalizedEntities: loadTimeProfile.normalizedEntities,
        extractionIssues: loadTimeProfile.extractionIssues,
        fieldProvenance: loadTimeProfile.fieldProvenance,
        rawBriefExcerpt: loadTimeProfile.rawBriefExcerpt,
      },
    },
    CampaignBriefSidebar: {
      profileId: profileRow.id,
      initialStateProfile: loadTimeProfile,
      requirementsDerived: uiRequirements,
    },
  };
  printJson("UI props", uiProps);

  section("9. ROOT-CAUSE SNIPPETS");
  console.log("persisted.brandName:", persisted.brandName);
  console.log("persisted.market:", persisted.market);
  console.log("persisted.geography:", persisted.geography);
  console.log("persisted.audienceDetail?.countries:", persisted.audienceDetail?.countries);
  console.log("persisted.rawBriefExcerpt (len):", persisted.rawBriefExcerpt?.length);
  console.log("persisted.rawBriefExcerpt:", persisted.rawBriefExcerpt);
  console.log(
    "loadTime normalizedEntities.brand.brandName:",
    loadTimeProfile.normalizedEntities?.brand.brandName
  );
  console.log(
    "loadTime normalizedEntities.market.countryCode:",
    loadTimeProfile.normalizedEntities?.market.countryCode
  );
  console.log(
    "loadTime normalizedEntities.audience.countries:",
    loadTimeProfile.normalizedEntities?.audience.countries
  );
  console.log("uiRequirements.brandName:", uiRequirements.brandName);
  console.log("uiRequirements.marketCountry:", uiRequirements.marketCountry);
  console.log("uiRequirements.audienceCountries:", uiRequirements.audienceCountries);

  if (parsedText) {
    const idxParis = parsedText.toLowerCase().indexOf("paris");
    const idxMarket = parsedText.toLowerCase().indexOf("market");
    const idxEgypt = parsedText.toLowerCase().indexOf("egypt");
    console.log("\nDoc text positions:");
    console.log("  'paris' at:", idxParis, parsedText.slice(Math.max(0, idxParis - 20), idxParis + 40));
    console.log("  'market' at:", idxMarket, parsedText.slice(Math.max(0, idxMarket - 20), idxMarket + 40));
    console.log("  'egypt' at:", idxEgypt, parsedText.slice(Math.max(0, idxEgypt - 20), idxEgypt + 40));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
