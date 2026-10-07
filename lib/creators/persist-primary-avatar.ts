import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveNextPrimaryAvatar } from "@/lib/creator-enrichment/enrichment-avatar-policy";
import {
  collectAvatarCandidates,
  resolveDefaultMetricsPlatformAccountId,
  resolvePrimaryAvatar,
  type PlatformAccountAvatarInput,
} from "@/lib/creators/creator-centric";
import { extractDnaAvatarUrl, avatarSourceFromDnaUrl } from "@/lib/creators/dna-avatar";
import { loadCanonicalDnaByInfluencerIds } from "@/lib/creators/dna-browse-hydration";
import type { Database } from "@/types/database";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";

type AnySupabase = SupabaseClient<Database>;

/** Recompute and persist stable creator avatar + default metrics platform on influencers. */
export async function persistCreatorPrimaryIdentity(
  supabase: AnySupabase,
  influencerId: string,
  options: { resetFromLinkedAccounts?: boolean } = {}
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

  const { data: accountsData, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, profile_picture_url, avatar_source, metadata, follower_count, profile_display_name, handle")
    .eq("influencer_id", influencerId);

  const accounts = (accountsData ?? []) as PlatformAccountAvatarInput[];
  if (accountsError) throw new Error(accountsError.message);
  const reset = options.resetFromLinkedAccounts === true;
  if (reset && accounts.length === 0) throw new Error("No linked accounts are available to restore identity.");

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
    storedPrimaryAvatarUrl: reset ? null : row.primary_avatar_url,
    storedPrimaryAvatarSource: reset ? null : row.primary_avatar_source,
    influencerMetadata: reset ? { identity_linked_accounts_only: true } : row.metadata ?? null,
    discoveryProfileImageUrl: reset ? null : discoveryProfileImage,
    dnaAvatarUrl: reset ? null : dnaAvatarUrl,
    accounts,
    storedPrimaryMode: "all",
  });

  let resolved = resolvePrimaryAvatar(candidates);
  if (!reset && row.metadata?.identity_linked_accounts_only !== true && (!resolved.url || resolved.source === "placeholder") && dnaAvatarUrl) {
    resolved = {
      url: dnaAvatarUrl,
      source: avatarSourceFromDnaUrl(dnaAvatarUrl),
    };
  }

  // A usable, audience-ranked account photo is intentional, even when the old
  // smaller platform's photo happens to be stored in a higher-quality location.
  const rankedAccountWinner = candidates.some((candidate) =>
    candidate.platform && candidate.url?.trim() === resolved.url &&
    typeof candidate.followerCount === "number" &&
    Number.isFinite(candidate.followerCount) && candidate.followerCount >= 0 &&
    isUsableAvatarUrl(candidate.url)
  );
  const merged = reset || rankedAccountWinner ? resolved : resolveNextPrimaryAvatar({
    existingUrl: row.primary_avatar_url,
    existingSource: row.primary_avatar_source,
    incomingUrl: resolved.url,
    incomingSource: resolved.source,
  });

  const defaultMetricsPlatformAccountId = resolveDefaultMetricsPlatformAccountId(
    accounts,
    row.default_metrics_platform_account_id
  );

  const patch: Record<string, unknown> = {};
  if (reset) {
    const ranked = [...(accountsData ?? [])].sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0));
    patch.display_name = pickCreatorDisplayName(ranked.flatMap(account => [account.profile_display_name, account.handle]), ranked[0]?.handle);
    patch.metadata = { ...(row.metadata ?? {}), identity_linked_accounts_only: true };
  }
  if (
    merged.url !== row.primary_avatar_url ||
    merged.source !== row.primary_avatar_source
  ) {
    patch.primary_avatar_url = merged.url;
    patch.primary_avatar_source = merged.source;
  }
  if (
    defaultMetricsPlatformAccountId &&
    defaultMetricsPlatformAccountId !== row.default_metrics_platform_account_id
  ) {
    patch.default_metrics_platform_account_id = defaultMetricsPlatformAccountId;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase
      .from("influencers")
      .update(patch as never)
      .eq("id", influencerId);
    if (updateError) throw new Error(updateError.message);
  }

  return {
    primaryAvatarUrl: merged.url,
    defaultMetricsPlatformAccountId,
  };
}
