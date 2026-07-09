/**
 * Read-only per-creator rejection report for Apify dataset import.
 * Does NOT modify lib/ — traces importApifyStoredPayloadWithDnaPipeline steps.
 * Usage: npx tsx scripts/trace-dataset-import-rejections.ts [datasetId]
 */
import "@/lib/performance/script-env-preload";

import { createClient } from "@supabase/supabase-js";

import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";
import { fetchApifyDatasetItems } from "@/lib/discovery/apify-dataset-search";
import {
  extractHandleFromApifyRow,
  groupApifyRowsIntoCreators,
  isApifyProfileDetailRow,
} from "@/lib/discovery/apify-dataset-grouping";
import { importApifyStoredPayloadWithDnaPipeline } from "@/lib/discovery/apify-import-pipeline";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { buildCanonicalProfileUrl } from "@/lib/social/platforms";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

const DEFAULT_DATASET_ID = "dRicX0c18V4CXEaK7";
const DEFAULT_APIFY_RUN_ID = "HNm53zd970X0cjRQ0";
const PLATFORM = "instagram";
const MAX_CREATORS = 25;

type RowTrace = {
  row_index: number;
  handle: string | null;
  is_profile_detail: boolean;
  grouped_into_creator: string | null;
  skip_reason: string | null;
};

type CreatorRejection = {
  index: number;
  username: string;
  profileUrl: string;
  profile_rows: number;
  post_rows: number;
  orchestrator_skip: boolean;
  skip_reason: string | null;
  steps: Record<string, unknown>;
  final_verdict: string;
  import_result?: {
    ok: boolean;
    merged: boolean;
    message: string;
  };
  thrown_error?: string;
};

async function lookupExisting(
  supabase: ReturnType<typeof createClient>,
  platform: string,
  username: string
) {
  const [discovered, account] = await Promise.all([
    supabase
      .from("discovered_profiles")
      .select("id, influencer_id")
      .eq("platform", platform)
      .eq("username", username)
      .maybeSingle(),
    supabase
      .from("influencer_platform_accounts")
      .select("id, influencer_id")
      .eq("platform", platform)
      .eq("normalized_username", username)
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    discovered_profile: discovered.data,
    discovered_error: discovered.error?.message ?? null,
    platform_account: account.data,
    platform_account_error: account.error?.message ?? null,
    duplicate_would_merge: Boolean(discovered.data || account.data),
  };
}

async function dryRunInfluencerInsert(
  supabase: ReturnType<typeof createClient>,
  displayName: string,
  username: string
) {
  const { data, error } = await supabase
    .from("influencers")
    .insert({
      display_name: displayName || username,
      status: "active",
      enrichment_status: "enriched",
      notes: "DRY_RUN_PROBE_DELETE_ME",
      metadata: { import_probe: true, probe_at: new Date().toISOString() },
    } as never)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message, code: error.code, details: error.details, hint: error.hint };
  }

  const id = (data as { id: string } | null)?.id;
  if (id) {
    await supabase.from("influencers").delete().eq("id", id);
  }
  return { ok: true, probe_id: id, rolled_back: true };
}

async function main() {
  const datasetId = process.argv[2]?.trim() || DEFAULT_DATASET_ID;
  const env = getMetricsCollectorEnv();
  const token = env.apifyToken;
  if (!token) throw new Error("APIFY_TOKEN not configured");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);

  console.log("=== DATASET IMPORT REJECTION REPORT ===");
  console.log(JSON.stringify({ datasetId, apifyRunId: DEFAULT_APIFY_RUN_ID, platform: PLATFORM }, null, 2));

  const rows = await fetchApifyDatasetItems(datasetId, token, 1000);
  console.log("\n=== SUMMARY: ROWS ===");
  console.log(JSON.stringify({ total_dataset_rows: rows.length }, null, 2));

  const rowTraces: RowTrace[] = [];
  const handleToCreator = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const handle = extractHandleFromApifyRow(row);
    const isProfile = isApifyProfileDetailRow(row);
    let skipReason: string | null = null;
    if (!handle) skipReason = "no_handle_extracted_from_row";

    rowTraces.push({
      row_index: i,
      handle,
      is_profile_detail: isProfile,
      grouped_into_creator: handle,
      skip_reason: skipReason,
    });

    if (handle) {
      handleToCreator.set(handle, (handleToCreator.get(handle) ?? 0) + 1);
    }
  }

  const rowsWithoutHandle = rowTraces.filter((r) => !r.handle);
  const bundles = groupApifyRowsIntoCreators(rows, PLATFORM).slice(0, MAX_CREATORS);
  const bundlesBeyondCap = groupApifyRowsIntoCreators(rows, PLATFORM).length - bundles.length;

  console.log("\n=== SUMMARY: GROUPING ===");
  console.log(
    JSON.stringify(
      {
        rows_with_handle: rows.length - rowsWithoutHandle.length,
        rows_skipped_no_handle: rowsWithoutHandle.length,
        unique_creators_in_dataset: groupApifyRowsIntoCreators(rows, PLATFORM).length,
        creators_processed_cap: MAX_CREATORS,
        creators_truncated_by_cap: Math.max(0, bundlesBeyondCap),
        profile_detail_rows: rowTraces.filter((r) => r.is_profile_detail).length,
        post_only_rows: rowTraces.filter((r) => !r.is_profile_detail).length,
      },
      null,
      2
    )
  );

  const rejections: CreatorRejection[] = [];

  for (let i = 0; i < bundles.length; i++) {
    const bundle = bundles[i]!;
    const steps: Record<string, unknown> = {};
    let finalVerdict = "unknown";
    let orchestratorSkip = false;
    let skipReason: string | null = null;

    if (bundle.profileRows.length === 0 && bundle.postRows.length === 0) {
      orchestratorSkip = true;
      skipReason = "orchestrator_empty_bundle";
      finalVerdict = "SKIPPED_BY_ORCHESTRATOR";
    }

    const platform = canonicalPlatformKey(PLATFORM);
    const username = bundle.username.replace(/^@+/, "").trim().toLowerCase();
    steps.platform_username_validation = { platform, username, valid: Boolean(platform && username) };

    const profileUrl =
      bundle.profileUrl?.trim() ||
      (platform ? buildCanonicalProfileUrl(platform as "instagram", username) : null);
    steps.profile_url = { profileUrl, resolved: Boolean(profileUrl) };

    if (!profileUrl) {
      finalVerdict = "REJECTED_PROFILE_URL_UNRESOLVED";
    }

    if (bundle.profileRows.length === 0 && bundle.postRows.length === 0) {
      steps.rows = { profile_rows: 0, post_rows: 0 };
    } else {
      steps.rows = {
        profile_rows: bundle.profileRows.length,
        post_rows: bundle.postRows.length,
      };
    }

    const normalized =
      bundle.profileRows.length > 0 || bundle.postRows.length > 0
        ? normalizeApifyProfileData({
            platformKey: platform ?? PLATFORM,
            username,
            profileUrl: profileUrl ?? bundle.profileUrl,
            profileRows: bundle.profileRows,
            postRows: bundle.postRows,
            apifyRunId: DEFAULT_APIFY_RUN_ID,
          })
        : null;

    steps.normalization = normalized
      ? {
          ok: true,
          username: normalized.username,
          followers: normalized.followers,
          postsCount: normalized.postsCount,
          recentPublications: normalized.recentPublications?.length ?? 0,
          displayName: normalized.displayName,
        }
      : { ok: false, reason: "normalizeApifyProfileData_returned_null" };

    if (!normalized && finalVerdict === "unknown") {
      finalVerdict = "REJECTED_NORMALIZATION_FAILED";
    }

    const existing = await lookupExisting(supabase, platform ?? PLATFORM, username);
    steps.duplicate_detection = existing;

    if (normalized?.username) {
      steps.influencer_insert_probe = await dryRunInfluencerInsert(
        supabase,
        normalized.displayName ?? username,
        username
      );
    }

    let importResult: CreatorRejection["import_result"];
    let thrownError: string | undefined;

    if (!orchestratorSkip) {
      try {
        const result = await importApifyStoredPayloadWithDnaPipeline(supabase, {
          platform: PLATFORM,
          username: bundle.username,
          profileUrl: bundle.profileUrl,
          profileRows: bundle.profileRows,
          postRows: bundle.postRows,
          apifyRunId: DEFAULT_APIFY_RUN_ID,
          countryCode: "EG",
          categoryTags: ["Beauty"],
          searchId: "trace-dataset-import-rejections",
          uploadAvatar: false,
        });
        importResult = { ok: result.ok, merged: result.merged, message: result.message };
        steps.live_import = result;

        if (!result.ok) {
          finalVerdict = mapMessageToVerdict(result.message, existing);
        } else if (result.merged) {
          finalVerdict = "MERGED_EXISTING";
        } else {
          finalVerdict = "IMPORTED_NEW";
        }
      } catch (err) {
        thrownError = err instanceof Error ? err.message : String(err);
        finalVerdict = "REJECTED_EXCEPTION";
        steps.exception = {
          message: thrownError,
          stack: err instanceof Error ? err.stack?.split("\n").slice(0, 6) : undefined,
        };
      }
    }

    rejections.push({
      index: i + 1,
      username: bundle.username,
      profileUrl: bundle.profileUrl,
      profile_rows: bundle.profileRows.length,
      post_rows: bundle.postRows.length,
      orchestrator_skip: orchestratorSkip,
      skip_reason: skipReason,
      steps,
      final_verdict: finalVerdict,
      import_result: importResult,
      thrown_error: thrownError,
    });
  }

  console.log("\n=== PER-CREATOR REJECTION REPORT (all processed bundles) ===");
  for (const r of rejections) {
    console.log(JSON.stringify(r));
  }

  const verdictCounts: Record<string, number> = {};
  for (const r of rejections) {
    verdictCounts[r.final_verdict] = (verdictCounts[r.final_verdict] ?? 0) + 1;
  }

  console.log("\n=== VERDICT COUNTS ===");
  console.log(JSON.stringify(verdictCounts, null, 2));

  console.log("\n=== ROWS WITHOUT HANDLE (first 20) ===");
  console.log(JSON.stringify(rowsWithoutHandle.slice(0, 20), null, 2));

  console.log("\n=== ROOT CAUSE HINTS ===");
  const messages = rejections
    .map((r) => r.import_result?.message ?? r.thrown_error ?? r.skip_reason)
    .filter(Boolean);
  const uniqueMessages = [...new Set(messages)];
  console.log(JSON.stringify({ unique_failure_messages: uniqueMessages }, null, 2));
}

function mapMessageToVerdict(
  message: string,
  existing: Awaited<ReturnType<typeof lookupExisting>>
): string {
  if (message.includes("Platform and username are required")) return "REJECTED_VALIDATION_PLATFORM_USERNAME";
  if (message.includes("Profile URL could not be resolved")) return "REJECTED_PROFILE_URL";
  if (message.includes("No Apify rows supplied")) return "REJECTED_NO_ROWS";
  if (message.includes("could not be normalized")) return "REJECTED_NORMALIZATION";
  if (message.includes("IPL snapshot persistence failed")) return "REJECTED_IPL_SNAPSHOT_FAILED";
  if (message.includes("duplicate key") || message.includes("unique"))
    return "REJECTED_DB_CONSTRAINT";
  if (existing.duplicate_would_merge && message.toLowerCase().includes("merge"))
    return "MERGED_EXISTING";
  return `REJECTED_IMPORT_MESSAGE:${message.slice(0, 120)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
