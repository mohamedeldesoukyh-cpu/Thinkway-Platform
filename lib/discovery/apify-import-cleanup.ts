/**
 * Remove orphan influencers left by failed Apify dataset imports
 * (influencer row inserted, platform account insert failed before rollback existed).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OrphanApifyImportCleanupResult = {
  orphanInfluencersFound: number;
  orphanInfluencersDeleted: number;
  errors: string[];
};

export async function cleanupOrphanApifyImportInfluencers(
  supabase: SupabaseClient
): Promise<OrphanApifyImportCleanupResult> {
  const errors: string[] = [];

  const { data: candidates, error: queryError } = await supabase
    .from("influencers")
    .select("id, display_name, notes, metadata")
    .or(
      "notes.ilike.%Apify dataset export%,metadata->>import_source.eq.apify_dataset_export"
    );

  if (queryError) {
    return {
      orphanInfluencersFound: 0,
      orphanInfluencersDeleted: 0,
      errors: [queryError.message],
    };
  }

  const influencerIds = (candidates ?? []).map((row) => row.id as string);
  if (influencerIds.length === 0) {
    return { orphanInfluencersFound: 0, orphanInfluencersDeleted: 0, errors };
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id")
    .in("influencer_id", influencerIds);

  if (accountsError) {
    return {
      orphanInfluencersFound: 0,
      orphanInfluencersDeleted: 0,
      errors: [accountsError.message],
    };
  }

  const withAccount = new Set((accounts ?? []).map((row) => row.influencer_id as string));
  const orphanIds = influencerIds.filter((id) => !withAccount.has(id));

  let deleted = 0;
  for (const id of orphanIds) {
    const { error } = await supabase.from("influencers").delete().eq("id", id);
    if (error) {
      errors.push(`${id}: ${error.message}`);
    } else {
      deleted += 1;
    }
  }

  return {
    orphanInfluencersFound: orphanIds.length,
    orphanInfluencersDeleted: deleted,
    errors,
  };
}
