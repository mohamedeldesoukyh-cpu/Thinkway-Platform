import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveNextPrimaryAvatar } from "@/lib/creator-enrichment/enrichment-avatar-policy";
import { fetchImageBuffer } from "@/lib/creators/publication-preview-proxy";
import {
  parseCreatorAvatarStoragePathFromUrl,
  uploadEnrichmentCreatorAvatar,
} from "@/lib/discovery-import/import-avatar-storage";
import { isDisplayableAvatarUrl } from "@/lib/performance/avatar-sync-policy";

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
  // Allow expired social CDN URLs — fetch may still succeed briefly after Apify returns them.
  if (!isDisplayableAvatarUrl(providerUrl)) {
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

  const { data: influencer } = await supabase
    .from("influencers")
    .select("primary_avatar_url, primary_avatar_source")
    .eq("id", input.influencerId)
    .maybeSingle();

  const row = influencer as {
    primary_avatar_url?: string | null;
    primary_avatar_source?: string | null;
  } | null;

  const nextPrimary = resolveNextPrimaryAvatar({
    existingUrl: row?.primary_avatar_url,
    existingSource: row?.primary_avatar_source,
    incomingUrl: publicUrl,
    incomingSource: "uploaded",
  });

  if (
    nextPrimary.url !== row?.primary_avatar_url ||
    nextPrimary.source !== row?.primary_avatar_source
  ) {
    await supabase
      .from("influencers")
      .update({
        primary_avatar_url: nextPrimary.url,
        primary_avatar_source: nextPrimary.source,
        updated_at: syncedAt,
      } as never)
      .eq("id", input.influencerId);
  }

  return { uploaded: true, url: publicUrl };
}
