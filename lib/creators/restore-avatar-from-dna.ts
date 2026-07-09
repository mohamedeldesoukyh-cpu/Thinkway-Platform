import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import type { Database } from "@/types/database";

import {
  avatarSourceFromDnaUrl,
  extractDnaAvatarUrl,
  shouldRestoreAvatarFromDna,
} from "./dna-avatar";

export type RestoreAvatarsFromDnaResult = {
  scanned: number;
  restored: number;
  skipped: number;
  influencerIds: string[];
};

type DnaRow = {
  influencer_id: string;
  document: unknown;
};

/**
 * Restore influencers.primary_avatar_url from Creator DNA when DNA still has a photo
 * but the influencer row lost it (e.g. expired CDN sync cleared the stored primary).
 * No enrichment — reads existing creator_dna only.
 */
export async function restoreInfluencerAvatarsFromDna(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<RestoreAvatarsFromDnaResult> {
  const uniqueIds = [...new Set(influencerIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { scanned: 0, restored: 0, skipped: 0, influencerIds: [] };
  }

  const [{ data: influencers }, { data: dnaRows }] = await Promise.all([
    supabase
      .from("influencers")
      .select("id, primary_avatar_url, primary_avatar_source")
      .in("id", uniqueIds),
    supabase.from("creator_dna").select("influencer_id, document").in("influencer_id", uniqueIds),
  ]);

  const influencerById = new Map(
    (influencers ?? []).map((row) => [
      row.id,
      row as {
        id: string;
        primary_avatar_url: string | null;
        primary_avatar_source: string | null;
      },
    ])
  );

  const dnaByInfluencer = new Map<string, string | null>();
  for (const row of (dnaRows ?? []) as DnaRow[]) {
    dnaByInfluencer.set(row.influencer_id, extractDnaAvatarUrl(parseCreatorDNADocument(row.document)));
  }

  const restoredIds: string[] = [];
  let skipped = 0;

  for (const influencerId of uniqueIds) {
    const influencer = influencerById.get(influencerId);
    if (!influencer) {
      skipped += 1;
      continue;
    }

    const dnaAvatar = dnaByInfluencer.get(influencerId) ?? null;
    if (!shouldRestoreAvatarFromDna(influencer.primary_avatar_url, dnaAvatar)) {
      skipped += 1;
      continue;
    }

    const source = avatarSourceFromDnaUrl(dnaAvatar!);
    const { error } = await supabase
      .from("influencers")
      .update({
        primary_avatar_url: dnaAvatar,
        primary_avatar_source: source,
      } as never)
      .eq("id", influencerId);

    if (error) {
      skipped += 1;
      continue;
    }

    restoredIds.push(influencerId);
  }

  return {
    scanned: uniqueIds.length,
    restored: restoredIds.length,
    skipped,
    influencerIds: restoredIds,
  };
}

/** Scan all influencers with DNA avatars and restore missing/broken primaries. */
export async function restoreAllInfluencerAvatarsFromDna(
  supabase: SupabaseClient<Database>,
  options?: { limit?: number; offset?: number }
): Promise<RestoreAvatarsFromDnaResult> {
  const limit = options?.limit ?? 500;
  const offset = options?.offset ?? 0;

  const { data: dnaRows, error } = await supabase
    .from("creator_dna")
    .select("influencer_id, document")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const influencerIds = (dnaRows ?? [])
    .map((row) => {
      const avatar = extractDnaAvatarUrl(
        parseCreatorDNADocument((row as DnaRow).document)
      );
      return avatar ? (row as DnaRow).influencer_id : null;
    })
    .filter((id): id is string => Boolean(id));

  return restoreInfluencerAvatarsFromDna(supabase, influencerIds);
}
