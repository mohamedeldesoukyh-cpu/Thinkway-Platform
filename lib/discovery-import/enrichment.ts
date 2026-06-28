import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { fetchApifyProfile } from "@/lib/creator-enrichment/apify-profile";
import { buildCanonicalProfileUrl, isSocialPlatform } from "@/lib/social/platforms";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import {
  enrichAndPersistPlatformAvatar,
  persistInfluencerPlatformAvatarDetailed,
} from "@/lib/performance/metrics-collector/persist";
import type { Database } from "@/types/database";

import type { CreatorImportEnrichmentJobPayload, ImportEnrichmentAccountRef } from "./types";

function logImportAvatar(event: string, data: Record<string, unknown>): void {
  console.log(`[import] ${event}`, JSON.stringify(data));
}

/** Queue avatar-only enrichment for imported creators missing profile photos. */
export async function queueImportedCreatorAvatarEnrichment(
  accounts: ImportEnrichmentAccountRef[],
  importFileId?: string
): Promise<number> {
  if (accounts.length === 0) return 0;

  const { enqueueCreatorImportEnrichmentJob } = await import("./queue");

  let queued = 0;
  for (const account of accounts) {
    const result = await enqueueCreatorImportEnrichmentJob({
      influencerId: account.influencerId,
      platformAccountId: account.platformAccountId,
      platform: account.platform,
      username: account.username,
      importFileId,
    });
    if (result.queued) {
      queued += 1;
      logImportAvatar("avatar enrichment queued", {
        importFileId,
        influencerId: account.influencerId,
        platformAccountId: account.platformAccountId,
        platform: account.platform,
        username: account.username,
      });
    }
  }

  return queued;
}

/**
 * @deprecated Full metrics enrichment is not auto-queued on import. Use avatar-only queue.
 */
export async function queueImportedCreatorEnrichment(
  _supabase: SupabaseClient<Database>,
  accounts: ImportEnrichmentAccountRef[],
  importFileId?: string
): Promise<number> {
  return queueImportedCreatorAvatarEnrichment(accounts, importFileId);
}

/**
 * Worker handler for `creator-import-enrich` jobs — avatar-only (Apify profile photo, then open-graph).
 */
export async function enrichImportedCreatorAvatar(
  supabase: SupabaseClient<Database>,
  payload: CreatorImportEnrichmentJobPayload
): Promise<{ ok: boolean; message: string }> {
  const platformKey = canonicalPlatformKey(payload.platform);
  const username = payload.username.trim().replace(/^@+/, "");

  const { data: account, error: loadError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, profile_picture_url, profile_url, handle, username")
    .eq("id", payload.platformAccountId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, message: loadError.message };
  }
  if (!account) {
    return { ok: false, message: "Platform account not found." };
  }

  if (isUsableAvatarUrl(account.profile_picture_url)) {
    return { ok: true, message: "Avatar already present." };
  }

  const profileUrl =
    account.profile_url?.trim() ||
    (isSocialPlatform(platformKey)
      ? buildCanonicalProfileUrl(platformKey, username)
      : "") ||
    "";

  const fetched = await fetchApifyProfile({
    platform: platformKey,
    username,
    profileUrl,
    timeoutMs: 120_000,
  });

  if (fetched.ok && fetched.data.profilePictureUrl) {
    const avatarResult = await persistInfluencerPlatformAvatarDetailed(supabase, {
      influencerId: payload.influencerId,
      platform: platformKey,
      profilePictureUrl: fetched.data.profilePictureUrl,
      source: "apify",
      forceSync: true,
      logSkips: true,
    });

    if (avatarResult.saved) {
      logImportAvatar("avatar persisted", {
        influencerId: payload.influencerId,
        platformAccountId: payload.platformAccountId,
        platform: platformKey,
        username,
        source: "apify",
      });
      return { ok: true, message: "Avatar persisted from Apify." };
    }
  }

  const ogResult = await enrichAndPersistPlatformAvatar(supabase, {
    influencerId: payload.influencerId,
    platform: platformKey,
    logSkips: true,
  });

  if (ogResult.saved) {
    logImportAvatar("avatar persisted", {
      influencerId: payload.influencerId,
      platformAccountId: payload.platformAccountId,
      platform: platformKey,
      username,
      source: "discovery",
    });
    return { ok: true, message: "Avatar persisted from open-graph." };
  }

  const reason = fetched.ok
    ? "No usable avatar returned from Apify or open-graph."
    : fetched.reason;
  return { ok: false, message: reason };
}

/** @deprecated Alias for worker — avatar-only enrichment. */
export async function enrichImportedPlatformAccount(
  supabase: SupabaseClient<Database>,
  payload: CreatorImportEnrichmentJobPayload
): Promise<{ ok: boolean; message: string }> {
  return enrichImportedCreatorAvatar(supabase, payload);
}
