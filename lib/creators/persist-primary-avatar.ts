import type { SupabaseClient } from "@supabase/supabase-js";

import {
  collectAvatarCandidates,
  resolveDefaultMetricsPlatformAccountId,
  resolvePrimaryAvatar,
  type PlatformAccountAvatarInput,
} from "@/lib/creators/creator-centric";
import { extractDnaAvatarUrl, avatarSourceFromDnaUrl } from "@/lib/creators/dna-avatar";
import { loadCanonicalDnaByInfluencerIds } from "@/lib/creators/dna-browse-hydration";
import type { Database } from "@/types/database";

type AnySupabase = SupabaseClient<Database>;

/** Recompute and persist stable creator avatar + default metrics platform on influencers. */
export async function persistCreatorPrimaryIdentity(
  supabase: AnySupabase,
  influencerId: string
): Promise<{ primaryAvatarUrl: string | null; defaultMetricsPlatformAccountId: string | null }> {
  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .select(
      "id, metadata, primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id, profile_id"
    )
    .eq("id", influencerId)
    .maybeSingle();

  if (influencerError) throw new Error(influencerError.message);
  if (!influencer) {
    return { primaryAvatarUrl: null, defaultMetricsPlatformAccountId: null };
  }

  const row = influencer as {
    metadata?: Record<string, unknown> | null;
    primary_avatar_url?: string | null;
    primary_avatar_source?: string | null;
    default_metrics_platform_account_id?: string | null;
    profile_id?: string | null;
  };

  const { data: accountsData } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, profile_picture_url, avatar_source, metadata, follower_count")
    .eq("influencer_id", influencerId);

  const accounts = (accountsData ?? []) as PlatformAccountAvatarInput[];

  let discoveryProfileImage: string | null = null;
  const { data: linkedDiscovery } = await supabase
    .from("discovered_profiles")
    .select("profile_image_url")
    .eq("influencer_id", influencerId)
    .limit(1)
    .maybeSingle();
  discoveryProfileImage =
    (linkedDiscovery as { profile_image_url?: string | null } | null)?.profile_image_url ?? null;

  const dnaDocuments = await loadCanonicalDnaByInfluencerIds(supabase, [influencerId]);
  const dnaAvatarUrl = extractDnaAvatarUrl(dnaDocuments.get(influencerId) ?? null);

  const candidates = collectAvatarCandidates({
    storedPrimaryAvatarUrl: row.primary_avatar_url,
    storedPrimaryAvatarSource: row.primary_avatar_source,
    influencerMetadata: row.metadata ?? null,
    discoveryProfileImageUrl: discoveryProfileImage,
    dnaAvatarUrl,
    accounts,
    storedPrimaryMode: "all",
  });

  let resolved = resolvePrimaryAvatar(candidates);
  if ((!resolved.url || resolved.source === "placeholder") && dnaAvatarUrl) {
    resolved = {
      url: dnaAvatarUrl,
      source: avatarSourceFromDnaUrl(dnaAvatarUrl),
    };
  }
  const defaultMetricsPlatformAccountId = resolveDefaultMetricsPlatformAccountId(
    accounts,
    row.default_metrics_platform_account_id
  );

  const patch: Record<string, unknown> = {};
  if (
    resolved.url !== row.primary_avatar_url ||
    resolved.source !== row.primary_avatar_source
  ) {
    patch.primary_avatar_url = resolved.url;
    patch.primary_avatar_source = resolved.source;
  }
  if (
    defaultMetricsPlatformAccountId &&
    defaultMetricsPlatformAccountId !== row.default_metrics_platform_account_id
  ) {
    patch.default_metrics_platform_account_id = defaultMetricsPlatformAccountId;
  }

  if (Object.keys(patch).length > 0) {
    await supabase
      .from("influencers")
      .update(patch as never)
      .eq("id", influencerId);
  }

  return {
    primaryAvatarUrl: resolved.url,
    defaultMetricsPlatformAccountId,
  };
}
