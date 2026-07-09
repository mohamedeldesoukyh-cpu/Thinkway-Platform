/**
 * Post-fix validation: cleanup orphans, replay dataset dRicX0c18V4CXEaK7, re-search.
 * Usage: npx tsx scripts/replay-dataset-import-validation.ts
 */
import "@/lib/performance/script-env-preload";

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import {
  createEmptyCampaignIntelligenceProfile,
  type CampaignIntelligenceProfile,
} from "@/features/campaign-intelligence-profile/types/profile";
import { filtersToBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { cleanupOrphanApifyImportInfluencers } from "@/lib/discovery/apify-import-cleanup";
import { groupApifyRowsIntoCreators } from "@/lib/discovery/apify-dataset-grouping";
import { fetchApifyDatasetItems } from "@/lib/discovery/apify-dataset-search";
import { runStoredApifyDatasetImport } from "@/lib/discovery/dataset-acquisition-orchestrator";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";

const DATASET_ID = "dRicX0c18V4CXEaK7";
const APIFY_RUN_ID = "HNm53zd970X0cjRQ0";

function lorealBrowseFilters() {
  const raw: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "L'Oréal Paris",
    platforms: ["instagram", "tiktok"],
    market: "Egypt",
    audienceDetail: { gender: "Female", ageMin: 25, ageMax: 45, countries: ["EG"] },
    creatorCategories: ["Beauty", "20k-500k followers"],
    creatorNiches: ["skincare", "vitamin c"],
    sources: { geography: "brief", platforms: "brief", audience: "brief", brandName: "brief" },
    confidence: { geography: 0.9, platforms: 0.9, audience: 0.88, brandName: 0.9 },
  };
  const profile = normalizeFromProfile(raw).profile;
  const criteria = buildSearchStrategyFromProfile(profile);
  return filtersToBrowseParams(buildCreatorFiltersFromProfile(profile, criteria), 1, 50);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const searchId = randomUUID();

  console.log("=== 1. CLEANUP ORPHAN INFLUENCERS ===");
  const cleanup = await cleanupOrphanApifyImportInfluencers(supabase);
  console.log(JSON.stringify(cleanup, null, 2));

  const token = getMetricsCollectorEnv().apifyToken;
  if (!token) throw new Error("APIFY_TOKEN not configured");

  const rows = await fetchApifyDatasetItems(DATASET_ID, token, 1000);
  const grouped = groupApifyRowsIntoCreators(rows, "instagram");

  const dnaBefore = await supabase.from("creator_dna").select("influencer_id", { count: "exact", head: true });

  console.log("\n=== 2. REPLAY STORED DATASET IMPORT ===");
  const importResult = await runStoredApifyDatasetImport(supabase, {
    searchId,
    platform: "instagram",
    datasetId: DATASET_ID,
    apifyRunId: APIFY_RUN_ID,
    countryCode: "EG",
    categoryTags: ["Beauty"],
    intelligence: {
      acquisitionHints: { broadenCreatorDiscovery: true },
    } as never,
  });
  console.log(JSON.stringify(importResult, null, 2));

  const dnaAfter = await supabase.from("creator_dna").select("influencer_id", { count: "exact", head: true });
  const creatorDnaCreated = Math.max(0, (dnaAfter.count ?? 0) - (dnaBefore.count ?? 0));

  console.log("\n=== 3. SECOND SEARCH (post-import browse) ===");
  const browseFilters = lorealBrowseFilters();
  const preSearch = await browseUnifiedCreators(supabase, browseFilters, "discovery");
  const postSearch = await browseUnifiedCreators(supabase, browseFilters, "discovery");

  console.log(
    JSON.stringify(
      {
        search_id: searchId,
        dataset_rows: rows.length,
        creators_grouped: grouped.length,
        creators_processed: importResult.creatorsProcessed,
        imported: importResult.creatorsImported,
        merged: importResult.creatorsMerged,
        failed: importResult.creatorsFailed,
        skipped: importResult.creatorsSkipped,
        creator_dna_records_created: creatorDnaCreated,
        creator_dna_total_after: dnaAfter.count ?? 0,
        second_search_total: postSearch.total,
        second_search_returned: postSearch.creators.length,
        second_search_internal: postSearch.internal_count,
        second_search_discovery: postSearch.discovery_count,
        pre_import_total: preSearch.total,
      },
      null,
      2
    )
  );

  const orphansAfter = await cleanupOrphanApifyImportInfluencers(supabase);
  console.log("\n=== 4. ORPHANS AFTER IMPORT (should be 0) ===");
  console.log(JSON.stringify(orphansAfter, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
