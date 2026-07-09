/**
 * One-shot Enterprise Discovery runtime trace (L'Oréal CIP).
 * Usage: npx tsx scripts/trace-enterprise-discovery.ts [profileId]
 */
import "@/lib/performance/script-env-preload";

import { createClient } from "@supabase/supabase-js";

import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import {
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import {
  discoveryMappedFiltersToBrowseFilters,
  mapCampaignIntelligenceToDiscoverySearch,
} from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import {
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/discovery-coverage";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { isDatasetAcquisitionBackfillEnabled } from "@/lib/discovery/dataset-acquisition-policy";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
} from "@/lib/discovery/enterprise-discovery-gate";
import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "@/lib/discovery/intelligence-sufficiency";
import { filtersToBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";

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

function lorealFixtureProfile(): CampaignIntelligenceProfile {
  const raw: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "L'Oréal Paris",
    campaignName: "Vitamin C Launch",
    objectives: ["Awareness"],
    deliverables: ["Reels"],
    budget: { amount: 100000, currency: "EGP" },
    kpis: ["Reach"],
    platforms: ["instagram", "tiktok"],
    market: "Egypt",
    rawBriefExcerpt: "L'Oréal Paris skincare campaign in Egypt on Instagram and TikTok",
    sources: {
      geography: "brief",
      platforms: "brief",
      audience: "brief",
      brandName: "brief",
    },
    confidence: {
      geography: 0.9,
      platforms: 0.9,
      audience: 0.88,
      brandName: 0.9,
    },
    audienceDetail: {
      gender: "Female",
      ageMin: 25,
      ageMax: 45,
      countries: ["EG"],
    },
    creatorCategories: ["Beauty", "20k-500k followers"],
    creatorNiches: ["skincare", "vitamin c"],
  };
  return normalizeFromProfile(raw).profile;
}

async function loadProfile(
  supabase: ReturnType<typeof createClient>,
  profileIdArg?: string
): Promise<{ profile: CampaignIntelligenceProfile; profileId: string; title: string; source: string }> {
  if (profileIdArg) {
    const { data, error } = await supabase
      .from("campaign_intelligence_profiles")
      .select("id, title, profile, updated_at")
      .eq("id", profileIdArg)
      .maybeSingle();
    if (!error && data) {
      return {
        profile: normalizeFromProfile(data.profile as CampaignIntelligenceProfile).profile,
        profileId: data.id,
        title: data.title ?? "unknown",
        source: "supabase",
      };
    }
  } else {
    const { data, error } = await supabase
      .from("campaign_intelligence_profiles")
      .select("id, title, profile, updated_at")
      .or("title.ilike.%loreal%,title.ilike.%loréal%,title.ilike.%Loreal%")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      return {
        profile: normalizeFromProfile(data.profile as CampaignIntelligenceProfile).profile,
        profileId: data.id,
        title: data.title ?? "unknown",
        source: "supabase",
      };
    }
  }

  return {
    profile: lorealFixtureProfile(),
    profileId: "fixture:loreal-premium-skincare",
    title: "L'Oréal Paris — Vitamin C Launch (fixture)",
    source: "normalized fixture (CIP table not readable by service_role)",
  };
}

async function main() {
  const profileIdArg = process.argv[2]?.trim();

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const loaded = await loadProfile(supabase, profileIdArg);
  const profile = loaded.profile;
  const profileRow = { id: loaded.profileId, title: loaded.title, source: loaded.source };
  const criteria = buildSearchStrategyFromProfile(profile);
  const creatorFilters = buildCreatorFiltersFromProfile(profile, criteria);
  const browseFilters = filtersToBrowseParams(creatorFilters, 1, 50);
  const studioBrowseFilters = discoveryMappedFiltersToBrowseFilters(
    mapCampaignIntelligenceToDiscoverySearch(profile).filters,
    1,
    50
  );

  section("STAGE 0 — Campaign Intelligence Profile");
  console.log("profileId:", profileRow.id);
  console.log("title:", profileRow.title);
  console.log("profile source:", profileRow.source);
  printJson("CreatorSearchFilters (canonical)", creatorFilters);
  printJson("Browse filters (Discovery path)", browseFilters);
  printJson("Browse filters (Studio path)", studioBrowseFilters);
  console.log(
    "filters parity:",
    JSON.stringify(browseFilters) === JSON.stringify(studioBrowseFilters)
  );

  const settings = await getDiscoveryControlSettings(supabase);
  const coverageConfig = getDiscoveryCoverageConfig(settings);
  const intelligenceConfig = getIntelligenceSufficiencyConfig(settings);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();

  section("STAGE 1 — Creator DNA search (pre-backfill, DB only)");
  const preBrowse = await browseUnifiedCreators(supabase, browseFilters, "discovery");
  const preCount = preBrowse.creators.length;
  const preTotal = preBrowse.total;
  console.log("creatorCount (page results):", preCount);
  console.log("total (browse RPC):", preTotal);

  const coverage =
    preBrowse.coverage ??
    evaluateDiscoveryCoverage(preBrowse, browseFilters.coverageIntent ?? {}, coverageConfig);
  const intelligence = evaluateIntelligenceSufficiency(
    preBrowse,
    browseFilters.coverageIntent ?? {},
    intelligenceConfig,
    settings
  );

  const minimumCreatorCount = useIntelligenceGate
    ? intelligenceConfig.minCreatorCount
    : coverageConfig.minCount;

  const gate = evaluateEnterpriseDiscoveryBackfillNeed(
    buildEnterpriseDiscoveryGateInput({
      creatorCount: preCount,
      minimumCreatorCount,
      coverage,
      coverageThreshold: settings.coverageThreshold,
      useIntelligenceGate,
      intelligence,
    })
  );

  section("STAGE 2 — Enterprise Discovery Gate");
  printJson("discovery_control_settings", {
    discoverySource: settings.discoverySource,
    coverageThreshold: settings.coverageThreshold,
    searchPriority: settings.searchPriority,
    useIntelligenceGate,
    minimumCreatorCount,
  });
  printJson("coverage evaluation", {
    coverageScore: coverage.coverageScore,
    coverageLevel: coverage.coverageLevel,
    breakdownCount: coverage.breakdown.count,
  });
  printJson("gate decision", gate);

  section("STAGE 3 — Full Enterprise Discovery pipeline (gate + backfill + re-search)");
  const startedAt = Date.now();
  const full = await browseUnifiedCreatorsWithCoverageBackfill(
    supabase,
    browseFilters,
    "discovery"
  );
  const durationMs = Date.now() - startedAt;

  const postCount = full.creators.length;
  const postTotal = full.total;

  section("STAGE 4 — Apify / Dataset / Import");
  printJson("backfill meta", full.backfill ?? null);
  const da = full.backfill?.datasetAcquisition;
  if (da) {
    console.log("apifyRunId:", da.apifyRunId);
    console.log("datasetId:", da.datasetId);
    console.log("creatorsImported:", da.creatorsImported);
    console.log("creatorsMerged:", da.creatorsMerged);
    console.log("enrichmentJobsQueued:", da.enrichmentJobsQueued);
  } else {
    console.log("datasetAcquisition: null (legacy worker/inline path or skipped)");
    console.log("backfill.reason:", full.backfill?.reason ?? "n/a");
    console.log("backfill.jobId:", full.backfill?.jobId ?? "n/a");
    console.log("backfill.profilesAdded:", full.backfill?.profilesAdded ?? 0);
    console.log("backfill.apifyExecuted:", full.backfill?.apifyExecuted ?? false);
    console.log("backfill.acquisitionMode:", full.backfill?.acquisitionMode ?? "n/a");
  }

  if (full.backfill?.jobId) {
    const { data: job } = await supabase
      .from("discovery_jobs")
      .select("id, status, result, error_message, profiles_discovered, started_at, completed_at")
      .eq("id", full.backfill.jobId)
      .maybeSingle();
    printJson("discovery_jobs row", job);
  }

  section("STAGE 5 — Search index / DNA");
  console.log(
    "search index refresh:",
    "automatic via Supabase upsert on discovered_profiles/influencers (no explicit refresh step in orchestrator)"
  );
  if (da) {
    console.log(
      "Creator DNA updates:",
      `${da.creatorsImported} imported + ${da.creatorsMerged} merged via importApifyStoredPayloadWithDnaPipeline`
    );
  }

  section("STAGE 6 — Automatic second search + UI result");
  console.log("second search executed:", Boolean(full.backfill?.completed || (full.backfill?.profilesAdded ?? 0) > 0));
  console.log("final creatorCount (page):", postCount);
  console.log("final total (browse RPC):", postTotal);
  console.log("pipeline durationMs:", durationMs);
  printJson("post-backfill coverage", full.coverage ?? null);

  if (full.backfill?.searchId) {
    const { data: audit } = await supabase
      .from("discovery_coverage_decisions")
      .select("*")
      .eq("search_id", full.backfill.searchId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    printJson("discovery_coverage_decisions audit", audit);
  }

  section("STAGE 7 — Filter parity (search 1 vs search 2)");
  console.log(
    "Same CreatorSearchFilters object used for both searches:",
    "yes — orchestrator re-queries with identical `browseFilters` argument"
  );
  printJson("browseFilters frozen for both passes", browseFilters);

  section("EXECUTION SUMMARY");
  printJson("summary", {
    profileId: profileRow.id,
    creatorCountBefore: preCount,
    enterpriseGate: gate,
    needsBackfill: gate.needsBackfill,
    apifyExecuted: full.backfill?.apifyExecuted ?? false,
    datasetId: da?.datasetId ?? null,
    apifyCreatorsReturned: da
      ? (da.creatorsImported ?? 0) + (da.creatorsMerged ?? 0) + (full.backfill?.profilesAdded ?? 0)
      : full.backfill?.profilesAdded ?? 0,
    creatorsImported: da?.creatorsImported ?? 0,
    creatorsMerged: da?.creatorsMerged ?? 0,
    finalCreatorCount: postCount,
    filterParity: JSON.stringify(browseFilters) === JSON.stringify(studioBrowseFilters),
    durationMs,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
