/**
 * Resolve unified browse ids to profile URLs for batch Apify acquisition.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";
import {
  ENRICHABLE_PLATFORMS,
  buildCanonicalProfileUrl,
  type SocialPlatform,
} from "@/lib/social/platforms";

import type { BatchProfileTarget } from "./batch-profile-acquisition-types";

type AnySupabase = SupabaseClient;

const ENRICHABLE_PLATFORM_SET = new Set<string>(ENRICHABLE_PLATFORMS);

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function accountToBatchTarget(input: {
  unifiedId: string;
  platform: string;
  handle?: string | null;
  profileUrl?: string | null;
  influencerId: string | null;
  discoveredProfileId: string | null;
  platformAccountId: string | null;
}): BatchProfileTarget | null {
  const platformKey = normalizeSocialPlatform(input.platform);
  if (!platformKey || !ENRICHABLE_PLATFORM_SET.has(platformKey)) return null;

  const username = normalizeUsername(input.handle ?? "");
  if (!username) return null;

  const profileUrl =
    input.profileUrl?.trim() || buildCanonicalProfileUrl(platformKey, username);

  return {
    unifiedId: input.unifiedId,
    platform: platformKey,
    username,
    profileUrl,
    influencerId: input.influencerId,
    discoveredProfileId: input.discoveredProfileId,
    platformAccountId: input.platformAccountId,
  };
}

export type ResolveBatchTargetsResult = {
  targets: BatchProfileTarget[];
  failed: Array<{ unifiedId: string; message: string }>;
};

export async function resolveBatchProfileTargets(
  supabase: AnySupabase,
  input: {
    unifiedIds: string[];
    platformAccountId?: string | null;
    requestedBy?: string | null;
  }
): Promise<ResolveBatchTargetsResult> {
  const targets: BatchProfileTarget[] = [];
  const failed: Array<{ unifiedId: string; message: string }> = [];
  const seen = new Set<string>();
  const seenTargetKeys = new Set<string>();

  for (const rawId of input.unifiedIds) {
    const unifiedId = rawId?.trim();
    if (!unifiedId || seen.has(unifiedId)) continue;
    seen.add(unifiedId);

    try {
      const resolved = await resolveBatchProfileTargetsForUnifiedId(supabase, {
        unifiedId,
        platformAccountId: input.platformAccountId,
      });
      if (resolved.length > 0) {
        for (const target of resolved) {
          const targetKey =
            target.platformAccountId ??
            `${target.unifiedId}:${target.platform}:${target.username}`;
          if (seenTargetKeys.has(targetKey)) continue;
          seenTargetKeys.add(targetKey);
          targets.push(target);
        }
      } else {
        failed.push({ unifiedId, message: "Could not resolve profile URL." });
      }
    } catch (error) {
      failed.push({
        unifiedId,
        message: error instanceof Error ? error.message : "Resolution failed.",
      });
    }
  }

  return { targets, failed };
}

async function resolveBatchProfileTargetsForUnifiedId(
  supabase: AnySupabase,
  input: {
    unifiedId: string;
    platformAccountId?: string | null;
  }
): Promise<BatchProfileTarget[]> {
  const unifiedId = input.unifiedId.trim();
  const [kind, id] = unifiedId.split(":");

  if (kind === "inf" && id) {
    const creator = await getUnifiedCreatorById(supabase, unifiedId);
    if (!creator) return [];

    const accounts = creator.platforms ?? [];
    const selectedAccounts = input.platformAccountId
      ? accounts.filter((account) => account.id === input.platformAccountId)
      : accounts;

    const targets: BatchProfileTarget[] = [];
    for (const account of selectedAccounts) {
      const target = accountToBatchTarget({
        unifiedId,
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profile_url,
        influencerId: creator.influencer_id ?? id,
        discoveredProfileId: creator.discovered_profile_id ?? null,
        platformAccountId: account.id,
      });
      if (target) targets.push(target);
    }
    return targets;
  }

  if (kind === "dis" && id) {
    const { data: profile, error } = await supabase
      .from("discovered_profiles")
      .select("id, platform, username, profile_url, influencer_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !profile) return [];

    const platformKey = normalizeSocialPlatform(profile.platform);
    if (!platformKey || !ENRICHABLE_PLATFORM_SET.has(platformKey)) return [];

    const username = normalizeUsername(profile.username ?? "");
    if (!username) return [];

    const profileUrl =
      profile.profile_url?.trim() || buildCanonicalProfileUrl(platformKey, username);

    let platformAccountId: string | null = null;
    if (profile.influencer_id) {
      const { data: accounts } = await supabase
        .from("influencer_platform_accounts")
        .select("id, platform")
        .eq("influencer_id", profile.influencer_id)
        .eq("normalized_username", username);
      const account = (accounts ?? []).find(
        (row) => normalizeSocialPlatform(row.platform as string) === platformKey
      );
      platformAccountId = account?.id ?? null;
    }

    const target = accountToBatchTarget({
      unifiedId,
      platform: platformKey,
      handle: username,
      profileUrl,
      influencerId: profile.influencer_id,
      discoveredProfileId: profile.id,
      platformAccountId,
    });
    return target ? [target] : [];
  }

  return [];
}

/** Group targets by platform for separate Apify actor runs. */
export function groupBatchTargetsByPlatform(
  targets: BatchProfileTarget[]
): Map<SocialPlatform, BatchProfileTarget[]> {
  const grouped = new Map<SocialPlatform, BatchProfileTarget[]>();
  for (const target of targets) {
    const bucket = grouped.get(target.platform) ?? [];
    bucket.push(target);
    grouped.set(target.platform, bucket);
  }
  return grouped;
}

export function chunkBatchTargets<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
