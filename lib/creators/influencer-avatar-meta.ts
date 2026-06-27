import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorAvatarUrl } from "@/lib/performance/creator-avatar";
import { fetchInfluencerMetaForPublications } from "@/lib/services/campaigns/repositories/publication-repository";
import type { VendorIoRow } from "@/lib/domains/io/types";

export type InfluencerAvatarFields = {
  creator_profile_image_url: string | null;
  influencer_avatar_url: string | null;
  creator_avatar_url: string | null;
};

type AvatarMeta = Awaited<
  ReturnType<typeof fetchInfluencerMetaForPublications>
>["avatars"];

export function resolveInfluencerAvatarFromMeta(
  avatars: AvatarMeta,
  influencerId: string,
  platform?: string | null
): string | null {
  const base = avatars.get(`${influencerId}:`);
  const platformKey = platform ? canonicalPlatformKey(platform) : null;
  const platformMeta = platformKey ? avatars.get(`${influencerId}:${platformKey}`) : null;

  return resolveCreatorAvatarUrl({
    social_profile_picture_url: platformMeta?.platformPicture ?? null,
    influencer_avatar_url: base?.influencerAvatar ?? null,
    creator_profile_image_url: base?.creatorProfileImage ?? null,
  });
}

export function resolveInfluencerAvatarFieldsFromMeta(
  avatars: AvatarMeta,
  influencerId: string,
  platform?: string | null
): InfluencerAvatarFields {
  const base = avatars.get(`${influencerId}:`);
  const platformKey = platform ? canonicalPlatformKey(platform) : null;
  const platformMeta = platformKey ? avatars.get(`${influencerId}:${platformKey}`) : null;

  const creator_profile_image_url = base?.creatorProfileImage ?? null;
  const influencer_avatar_url = base?.influencerAvatar ?? null;
  const social_profile_picture_url = platformMeta?.platformPicture ?? null;

  return {
    creator_profile_image_url,
    influencer_avatar_url,
    creator_avatar_url: resolveCreatorAvatarUrl({
      social_profile_picture_url,
      influencer_avatar_url,
      creator_profile_image_url,
    }),
  };
}

export async function fetchInfluencerAvatarMetaMap(
  supabase: SupabaseClient,
  influencerIds: string[]
): Promise<AvatarMeta> {
  if (influencerIds.length === 0) {
    return new Map();
  }
  const uniqueIds = [...new Set(influencerIds.filter(Boolean))];
  const { avatars } = await fetchInfluencerMetaForPublications(supabase, uniqueIds);
  return avatars;
}

export async function attachInfluencerAvatarsToVendorIoRows(
  supabase: SupabaseClient,
  rows: VendorIoRow[]
): Promise<VendorIoRow[]> {
  if (rows.length === 0) return rows;

  const avatars = await fetchInfluencerAvatarMetaMap(
    supabase,
    rows.map((row) => row.influencer_id)
  );

  return rows.map((row) => ({
    ...row,
    creator_avatar_url: resolveInfluencerAvatarFromMeta(avatars, row.influencer_id, "instagram"),
  }));
}
