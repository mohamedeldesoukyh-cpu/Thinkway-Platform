import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchImageBuffer } from "@/lib/creators/publication-preview-proxy";
import {
  parseCreatorAvatarStoragePathFromUrl,
  uploadEnrichmentCreatorAvatar,
} from "@/lib/discovery-import/import-avatar-storage";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";

export type EnrichmentAvatarStorageResult =
  | { uploaded: true; url: string }
  | { uploaded: false; reason: string };

/**
 * Download a provider avatar from enrichment and persist to creator-avatars storage.
 * No second Apify call — uses the URL already returned by the enrichment fetch.
 */
export async function syncEnrichmentAvatarToStorage(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platformAccountId: string;
    platform: string;
    username: string;
    providerAvatarUrl: string;
  }
): Promise<EnrichmentAvatarStorageResult> {
  const providerUrl = input.providerAvatarUrl.trim();
  if (!isUsableAvatarUrl(providerUrl)) {
    return { uploaded: false, reason: "invalid_provider_url" };
  }

  if (parseCreatorAvatarStoragePathFromUrl(providerUrl)) {
    return { uploaded: false, reason: "already_in_storage" };
  }

  const fetched = await fetchImageBuffer(providerUrl);
  if (!fetched.ok) {
    return { uploaded: false, reason: "fetch_failed" };
  }

  const username = input.username.replace(/^@/, "").trim();
  if (!username) {
    return { uploaded: false, reason: "missing_username" };
  }

  let publicUrl: string;
  try {
    publicUrl = await uploadEnrichmentCreatorAvatar({
      supabase,
      influencerId: input.influencerId,
      platform: input.platform,
      username,
      buffer: Buffer.from(fetched.buffer),
      contentType: fetched.contentType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { uploaded: false, reason: message };
  }

  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("influencer_platform_accounts")
    .update({
      profile_picture_url: publicUrl,
      avatar_source: "uploaded",
      avatar_last_synced_at: syncedAt,
      updated_at: syncedAt,
    } as never)
    .eq("id", input.platformAccountId);

  if (updateError) {
    return { uploaded: false, reason: updateError.message };
  }

  return { uploaded: true, url: publicUrl };
}
