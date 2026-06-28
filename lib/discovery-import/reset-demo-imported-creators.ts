import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ResetDemoImportedCreatorsResult = {
  ok: boolean;
  message: string;
  deletedInfluencers: number;
  deletedPlatformAccounts: number;
  deletedEnrichmentRuns: number;
  deletedCreatorSources: number;
  skippedInfluencers: number;
};

async function resolveCsvImportedInfluencerIds(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: csvFiles, error: filesError } = await supabase
    .from("creator_import_files")
    .select("id")
    .eq("file_type", "csv");

  if (filesError) {
    throw new Error(filesError.message);
  }

  const csvFileIds = (csvFiles ?? []).map((row) => row.id);
  if (csvFileIds.length > 0) {
    const { data: sources, error: sourcesError } = await supabase
      .from("creator_sources")
      .select("influencer_id")
      .in("source_file_id", csvFileIds);

    if (sourcesError) {
      throw new Error(sourcesError.message);
    }

    for (const row of sources ?? []) {
      ids.add(row.influencer_id);
    }
  }

  const { data: metadataMatches, error: metadataError } = await supabase
    .from("influencers")
    .select("id")
    .filter("metadata->>import_source", "eq", "csv");

  if (metadataError) {
    throw new Error(metadataError.message);
  }

  for (const row of metadataMatches ?? []) {
    ids.add(row.id);
  }

  return [...ids];
}

/**
 * Deletes CSV-imported demo creators and related rows in FK-safe order.
 * Uses service role — caller must enforce auth + demo-reset policy gates.
 */
export async function resetDemoImportedCreators(
  supabase: SupabaseClient<Database>
): Promise<ResetDemoImportedCreatorsResult> {
  const influencerIds = await resolveCsvImportedInfluencerIds(supabase);

  if (influencerIds.length === 0) {
    return {
      ok: true,
      message: "No CSV-imported creators found.",
      deletedInfluencers: 0,
      deletedPlatformAccounts: 0,
      deletedEnrichmentRuns: 0,
      deletedCreatorSources: 0,
      skippedInfluencers: 0,
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

  const skippedNote =
    skippedInfluencers > 0
      ? ` ${skippedInfluencers} influencer(s) could not be deleted (linked to campaigns or finance).`
      : "";

  return {
    ok: true,
    message: `Deleted ${deletedInfluencers} CSV-imported creator(s) and ${deletedPlatformAccounts} platform account(s).${skippedNote}`,
    deletedInfluencers,
    deletedPlatformAccounts,
    deletedEnrichmentRuns: enrichmentRunCount ?? 0,
    deletedCreatorSources: creatorSourceCount ?? 0,
    skippedInfluencers,
  };
}
