import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Matches all rows — PostgREST requires a filter on bulk delete. */
const DELETE_ALL_ROWS_FILTER = {
  column: "id" as const,
  value: "00000000-0000-0000-0000-000000000000",
};

async function countAllRows(
  supabase: SupabaseClient<Database>,
  table:
    | "discovered_profiles"
    | "profile_posts"
    | "profile_metrics"
    | "profile_ai_scores"
    | "discovery_sources"
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function deleteAllRows(
  supabase: SupabaseClient<Database>,
  table:
    | "discovered_profiles"
    | "profile_posts"
    | "profile_metrics"
    | "profile_ai_scores"
    | "discovery_sources"
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq(DELETE_ALL_ROWS_FILTER.column, DELETE_ALL_ROWS_FILTER.value);

  if (error) {
    throw new Error(error.message);
  }
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
  await deleteAllRows(supabase, "profile_metrics");
  await deleteAllRows(supabase, "profile_ai_scores");
  await deleteAllRows(supabase, "discovery_sources");
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

  const { data: importFiles, error: filesError } = await supabase
    .from("creator_import_files")
    .select("id");

  if (filesError) {
    throw new Error(filesError.message);
  }

  const importFileIds = (importFiles ?? []).map((row) => row.id);
  if (importFileIds.length === 0) {
    return [];
  }

  const { data: sources, error: sourcesError } = await supabase
    .from("creator_sources")
    .select("influencer_id")
    .in("source_file_id", importFileIds);

  if (sourcesError) {
    throw new Error(sourcesError.message);
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

  const { count: platformAccountCount, error: platformCountError } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .in("influencer_id", influencerIds);

  if (platformCountError) {
    throw new Error(platformCountError.message);
  }

  const { count: enrichmentRunCount, error: enrichmentCountError } = await supabase
    .from("creator_enrichment_runs")
    .select("id", { count: "exact", head: true })
    .in("influencer_id", influencerIds);

  if (enrichmentCountError) {
    throw new Error(enrichmentCountError.message);
  }

  const { count: creatorSourceCount, error: creatorSourceCountError } =
    await supabase
      .from("creator_sources")
      .select("id", { count: "exact", head: true })
      .in("influencer_id", influencerIds);

  if (creatorSourceCountError) {
    throw new Error(creatorSourceCountError.message);
  }

  const { error: enrichmentDeleteError } = await supabase
    .from("creator_enrichment_runs")
    .delete()
    .in("influencer_id", influencerIds);

  if (enrichmentDeleteError) {
    throw new Error(enrichmentDeleteError.message);
  }

  const { error: platformDeleteError } = await supabase
    .from("influencer_platform_accounts")
    .delete()
    .in("influencer_id", influencerIds);

  if (platformDeleteError) {
    throw new Error(platformDeleteError.message);
  }

  const { error: sourcesDeleteError } = await supabase
    .from("creator_sources")
    .delete()
    .in("influencer_id", influencerIds);

  if (sourcesDeleteError) {
    throw new Error(sourcesDeleteError.message);
  }

  let deletedInfluencers = 0;
  let skippedInfluencers = 0;

  for (const influencerId of influencerIds) {
    const { error } = await supabase
      .from("influencers")
      .delete()
      .eq("id", influencerId);

    if (error) {
      skippedInfluencers += 1;
      console.warn(
        `[admin] skipped influencer ${influencerId}: ${error.message}`
      );
      continue;
    }

    deletedInfluencers += 1;
  }

  const deletedPlatformAccounts = platformAccountCount ?? 0;

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

  return {
    ok: true,
    message: `Deleted ${deletedInfluencers} imported creator(s) and ${deletedPlatformAccounts} platform account(s).${skippedNote}${discoveryNote}`,
    deletedInfluencers,
    deletedPlatformAccounts,
    deletedEnrichmentRuns: enrichmentRunCount ?? 0,
    deletedCreatorSources: creatorSourceCount ?? 0,
    skippedInfluencers,
    ...discovery,
  };
}
