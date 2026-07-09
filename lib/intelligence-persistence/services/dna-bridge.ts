/**
 * IPL → Creator DNA bridge.
 * Called after ipl_snapshots are persisted or reprocessed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSnapshotById } from "./snapshot-service";
import { writeCreatorDnaFromSnapshot, CreatorDNAWriter } from "@/features/creator-dna/writers/creator-dna-writer";

type AnySupabase = SupabaseClient;

export type BridgeSnapshotOptions = {
  enrichmentRunId?: string | null;
  /** Storage-hosted avatar after enrichment upload — overrides provider CDN in DNA. */
  avatarUrlOverride?: string | null;
};

export async function bridgeSnapshotToCreatorDna(
  supabase: AnySupabase,
  snapshotId: string,
  options?: BridgeSnapshotOptions
): Promise<{ ok: boolean; message: string }> {
  const snapshot = await getSnapshotById(supabase, snapshotId);
  if (!snapshot) {
    const message = `Snapshot not found: ${snapshotId}`;
    console.warn("[ipl→dna]", message);
    return { ok: false, message };
  }

  if (!snapshot.influencerId && !snapshot.discoveredProfileId) {
    const message = `Snapshot ${snapshotId} has no influencer_id or discovered_profile_id`;
    console.warn("[ipl→dna]", message);
    return { ok: false, message };
  }

  const result = await writeCreatorDnaFromSnapshot(supabase, {
    snapshotId: snapshot.id,
    influencerId: snapshot.influencerId,
    discoveredProfileId: snapshot.discoveredProfileId,
    platformAccountId: snapshot.platformAccountId,
    normalized: snapshot.normalized,
    rawSnapshot: snapshot.raw,
    snapshotVersion: snapshot.snapshotVersion,
    fetchedAt: snapshot.normalized.fetchedAt,
    enrichmentRunId: options?.enrichmentRunId ?? null,
    avatarUrlOverride: options?.avatarUrlOverride ?? null,
  });

  if (!result.ok) {
    console.error("[ipl→dna] bridge failed", {
      snapshotId,
      influencerId: snapshot.influencerId,
      discoveredProfileId: snapshot.discoveredProfileId,
      message: result.message,
    });
  }

  return result;
}

export async function bridgeReprocessToCreatorDna(
  supabase: AnySupabase,
  input: {
    snapshotId: string;
    influencerId: string;
    categories: string[];
    snapshotVersion: number;
    fetchedAt: string;
  }
): Promise<void> {
  const writer = new CreatorDNAWriter(supabase);
  await writer.writeReprocessCategories(input);
}
