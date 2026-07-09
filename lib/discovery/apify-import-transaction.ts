/**
 * Compensating transaction for Apify dataset import.
 * Supabase JS has no multi-statement client transaction — on failure we delete
 * created artifacts in reverse FK order so orphan influencers cannot accumulate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApifyImportTransactionState = {
  influencerId?: string;
  influencerCreated: boolean;
  platformAccountId?: string;
  platformAccountCreated: boolean;
  discoveredProfileId?: string;
  discoveredProfileCreated: boolean;
  snapshotId?: string;
};

export function createApifyImportTransactionState(): ApifyImportTransactionState {
  return {
    influencerCreated: false,
    platformAccountCreated: false,
    discoveredProfileCreated: false,
  };
}

export async function rollbackApifyImportTransaction(
  supabase: SupabaseClient,
  state: ApifyImportTransactionState
): Promise<void> {
  if (state.snapshotId) {
    await supabase
      .from("creator_dna_lineage_events")
      .delete()
      .eq("snapshot_id", state.snapshotId);
    await supabase.from("ipl_snapshots").delete().eq("id", state.snapshotId);
  }

  if (state.discoveredProfileId && state.discoveredProfileCreated) {
    await supabase
      .from("creator_dna_staging")
      .delete()
      .eq("discovered_profile_id", state.discoveredProfileId);
    await supabase.from("discovered_profiles").delete().eq("id", state.discoveredProfileId);
  }

  if (state.influencerId && state.influencerCreated) {
    await supabase
      .from("creator_dna_versions")
      .delete()
      .eq("influencer_id", state.influencerId);
    await supabase.from("creator_dna").delete().eq("influencer_id", state.influencerId);
  }

  if (state.platformAccountId && state.platformAccountCreated) {
    await supabase
      .from("influencer_platform_accounts")
      .delete()
      .eq("id", state.platformAccountId);
  }

  if (state.influencerId && state.influencerCreated) {
    await supabase.from("influencers").delete().eq("id", state.influencerId);
  }
}
