import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ResetDemoImportedCreatorsOptions = {
  alsoDeleteDiscoveryProfiles?: boolean;
};

export type ResetDemoImportedCreatorsResult = {
  ok: boolean;
  message: string;
  deletedInfluencers: number;
  deletedPlatformAccounts: number;
  deletedEnrichmentRuns: number;
  deletedCreatorSources: number;
  skippedInfluencers: number;
  deletedDiscoveredProfiles: number;
  deletedProfilePosts: number;
};

const EMPTY_RESULT_COUNTS = {
  deletedInfluencers: 0,
  deletedPlatformAccounts: 0,
  deletedEnrichmentRuns: 0,
  deletedCreatorSources: 0,
  skippedInfluencers: 0,
  deletedDiscoveredProfiles: 0,
  deletedProfilePosts: 0,
} as const;

/** PostgREST `.in()` filters blow up URL size with large imports — stay conservative. */
const IN_FILTER_BATCH_SIZE = 80;

/** Parallel influencer deletes — balance throughput vs. connection limits. */
const INFLUENCER_DELETE_CONCURRENCY = 12;

/** Matches all rows — PostgREST requires a filter on bulk delete. */
const DELETE_ALL_ROWS_FILTER = {
  column: "id" as const,
  value: "00000000-0000-0000-0000-000000000000",
};

type DiscoveryStagingTable =
  | "profile_posts"
  | "profile_metrics"
  | "profile_engagement"
  | "profile_ai_scores"
  | "profile_relationships"
  | "discovery_sources"
  | "discovery_campaign_matches"
  | "discovered_profiles";

function chunkValues<T>(values: T[], size = IN_FILTER_BATCH_SIZE): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function formatResetDemoError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const pg = error as PostgrestError;
    const parts = [pg.message, pg.details, pg.hint, pg.code]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return fallback;
}

async function countAllRows(
  supabase: SupabaseClient<Database>,
  table: DiscoveryStagingTable
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(formatResetDemoError(error, `Failed to count ${table}.`));
  }

  return count ?? 0;
}

async function deleteAllRows(
  supabase: SupabaseClient<Database>,
  table: DiscoveryStagingTable
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq(DELETE_ALL_ROWS_FILTER.column, DELETE_ALL_ROWS_FILTER.value);

  if (error) {
    throw new Error(formatResetDemoError(error, `Failed to delete ${table}.`));
  }
}

async function countRowsByInfluencerIds(
  supabase: SupabaseClient<Database>,
  table: "influencer_platform_accounts" | "creator_enrichment_runs" | "creator_sources",
  influencerIds: string[]
): Promise<number> {
  let total = 0;

  for (const batch of chunkValues(influencerIds)) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("influencer_id", batch);

    if (error) {
      throw new Error(formatResetDemoError(error, `Failed to count ${table}.`));
    }

    total += count ?? 0;
  }

  return total;
}

async function deleteRowsByInfluencerIds(
  supabase: SupabaseClient<Database>,
  table: "creator_enrichment_runs" | "influencer_platform_accounts" | "creator_sources",
  influencerIds: string[]
): Promise<void> {
  for (const batch of chunkValues(influencerIds)) {
    const { error } = await supabase.from(table).delete().in("influencer_id", batch);

    if (error) {
      throw new Error(formatResetDemoError(error, `Failed to delete ${table}.`));
    }
  }
}

async function clearDefaultMetricsPlatformAccounts(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<void> {
  for (const batch of chunkValues(influencerIds)) {
    const { error } = await supabase
      .from("influencers")
      .update({ default_metrics_platform_account_id: null })
      .in("id", batch)
      .not("default_metrics_platform_account_id", "is", null);

    if (error) {
      throw new Error(
        formatResetDemoError(error, "Failed to clear default metrics platform accounts.")
      );
    }
  }
}

async function deleteInfluencersWithSkip(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<{ deletedInfluencers: number; skippedInfluencers: number; lastSkipReason: string | null }> {
  let deletedInfluencers = 0;
  let skippedInfluencers = 0;
  let lastSkipReason: string | null = null;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < influencerIds.length) {
      const index = cursor;
      cursor += 1;
      const influencerId = influencerIds[index];
      if (!influencerId) continue;

      const { error } = await supabase.from("influencers").delete().eq("id", influencerId);

      if (error) {
        skippedInfluencers += 1;
        lastSkipReason = formatResetDemoError(
          error,
          "Influencer is linked to campaigns, finance, or other protected records."
        );
        console.warn(`[admin] skipped influencer ${influencerId}: ${lastSkipReason}`);
        continue;
      }

      deletedInfluencers += 1;
    }
  }

  const workerCount = Math.min(INFLUENCER_DELETE_CONCURRENCY, influencerIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { deletedInfluencers, skippedInfluencers, lastSkipReason };
}

/**
 * Deletes all Discovery staging profiles and child rows in FK-safe order.
 * Uses service role — caller must enforce auth + demo-reset policy gates.
 */
export async function resetDemoDiscoveryProfiles(
  supabase: SupabaseClient<Database>
): Promise<Pick<
  ResetDemoImportedCreatorsResult,
  "deletedDiscoveredProfiles" | "deletedProfilePosts"
>> {
  const profilePostCount = await countAllRows(supabase, "profile_posts");
  const discoveredProfileCount = await countAllRows(
    supabase,
    "discovered_profiles"
  );

  if (discoveredProfileCount === 0 && profilePostCount === 0) {
    return {
      deletedDiscoveredProfiles: 0,
      deletedProfilePosts: 0,
    };
  }

  await deleteAllRows(supabase, "profile_posts");
  await deleteAllRows(supabase, "profile_engagement");
  await deleteAllRows(supabase, "profile_metrics");
  await deleteAllRows(supabase, "profile_ai_scores");
  await deleteAllRows(supabase, "profile_relationships");
  await deleteAllRows(supabase, "discovery_sources");
  await deleteAllRows(supabase, "discovery_campaign_matches");
  await deleteAllRows(supabase, "discovered_profiles");

  console.log(`[admin] deleted ${discoveredProfileCount} discovered profiles`);
  console.log(`[admin] deleted ${profilePostCount} profile posts`);

  return {
    deletedDiscoveredProfiles: discoveredProfileCount,
    deletedProfilePosts: profilePostCount,
  };
}

async function resolveImportCenterInfluencerIds(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: sources, error: sourcesError } = await supabase
    .from("creator_sources")
    .select("influencer_id")
    .not("source_file_id", "is", null);

  if (sourcesError) {
    throw new Error(formatResetDemoError(sourcesError, "Failed to load import creator sources."));
  }

  for (const row of sources ?? []) {
    ids.add(row.influencer_id);
  }

  return [...ids];
}

/**
 * Deletes Import Center demo creators and related rows in FK-safe order.
 * Uses service role — caller must enforce auth + demo-reset policy gates.
 */
export async function resetDemoImportedCreators(
  supabase: SupabaseClient<Database>,
  options?: ResetDemoImportedCreatorsOptions
): Promise<ResetDemoImportedCreatorsResult> {
  const influencerIds = await resolveImportCenterInfluencerIds(supabase);

  if (influencerIds.length === 0) {
    const discovery =
      options?.alsoDeleteDiscoveryProfiles === true
        ? await resetDemoDiscoveryProfiles(supabase)
        : { deletedDiscoveredProfiles: 0, deletedProfilePosts: 0 };

    const discoveryNote =
      discovery.deletedDiscoveredProfiles > 0 || discovery.deletedProfilePosts > 0
        ? ` Deleted ${discovery.deletedDiscoveredProfiles} discovery profile(s) and ${discovery.deletedProfilePosts} profile post(s).`
        : options?.alsoDeleteDiscoveryProfiles
          ? " No discovery profiles found."
          : "";

    return {
      ok: true,
      message: `No Import Center creators found.${discoveryNote}`,
      ...EMPTY_RESULT_COUNTS,
      ...discovery,
    };
  }

  const platformAccountCount = await countRowsByInfluencerIds(
    supabase,
    "influencer_platform_accounts",
    influencerIds
  );
  const enrichmentRunCount = await countRowsByInfluencerIds(
    supabase,
    "creator_enrichment_runs",
    influencerIds
  );
  const creatorSourceCount = await countRowsByInfluencerIds(
    supabase,
    "creator_sources",
    influencerIds
  );

  await deleteRowsByInfluencerIds(supabase, "creator_enrichment_runs", influencerIds);
  await clearDefaultMetricsPlatformAccounts(supabase, influencerIds);
  await deleteRowsByInfluencerIds(supabase, "influencer_platform_accounts", influencerIds);
  await deleteRowsByInfluencerIds(supabase, "creator_sources", influencerIds);

  const { deletedInfluencers, skippedInfluencers, lastSkipReason } =
    await deleteInfluencersWithSkip(supabase, influencerIds);

  const deletedPlatformAccounts = platformAccountCount;

  console.log(`[admin] deleted ${deletedInfluencers} influencers`);
  console.log(`[admin] deleted ${deletedPlatformAccounts} platform accounts`);

  const discovery =
    options?.alsoDeleteDiscoveryProfiles === true
      ? await resetDemoDiscoveryProfiles(supabase)
      : { deletedDiscoveredProfiles: 0, deletedProfilePosts: 0 };

  const skippedNote =
    skippedInfluencers > 0
      ? ` ${skippedInfluencers} influencer(s) could not be deleted (linked to campaigns or finance).`
      : "";

  const discoveryNote =
    discovery.deletedDiscoveredProfiles > 0 || discovery.deletedProfilePosts > 0
      ? ` Deleted ${discovery.deletedDiscoveredProfiles} discovery profile(s) and ${discovery.deletedProfilePosts} profile post(s).`
      : options?.alsoDeleteDiscoveryProfiles
        ? " No discovery profiles found."
        : "";

  const nothingDeleted =
    deletedInfluencers === 0 &&
    discovery.deletedDiscoveredProfiles === 0 &&
    discovery.deletedProfilePosts === 0;

  if (nothingDeleted && skippedInfluencers > 0) {
    return {
      ok: false,
      message:
        lastSkipReason ??
        `Could not delete imported creators.${skippedNote} Remove campaign or finance links and try again.`,
      deletedInfluencers,
      deletedPlatformAccounts,
      deletedEnrichmentRuns: enrichmentRunCount,
      deletedCreatorSources: creatorSourceCount,
      skippedInfluencers,
      ...discovery,
    };
  }

  return {
    ok: true,
    message: `Deleted ${deletedInfluencers} imported creator(s) and ${deletedPlatformAccounts} platform account(s).${skippedNote}${discoveryNote}`,
    deletedInfluencers,
    deletedPlatformAccounts,
    deletedEnrichmentRuns: enrichmentRunCount,
    deletedCreatorSources: creatorSourceCount,
    skippedInfluencers,
    ...discovery,
  };
}
