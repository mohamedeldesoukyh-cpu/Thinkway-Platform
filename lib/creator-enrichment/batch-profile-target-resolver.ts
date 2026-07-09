/**
 * Resolve unified browse ids to profile URLs for batch Apify acquisition.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import { buildCanonicalProfileUrl, isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";

import type { BatchProfileTarget } from "./batch-profile-acquisition-types";

type AnySupabase = SupabaseClient;

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
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

  for (const rawId of input.unifiedIds) {
    const unifiedId = rawId?.trim();
    if (!unifiedId || seen.has(unifiedId)) continue;
    seen.add(unifiedId);

    try {
      const target = await resolveOneBatchProfileTarget(supabase, {
        unifiedId,
        platformAccountId: input.platformAccountId,
        requestedBy: input.requestedBy,
      });
      if (target) {
        targets.push(target);
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

async function resolveOneBatchProfileTarget(
  supabase: AnySupabase,
  input: {
    unifiedId: string;
    platformAccountId?: string | null;
    requestedBy?: string | null;
  }
): Promise<BatchProfileTarget | null> {
  const unifiedId = input.unifiedId.trim();
  const [kind, id] = unifiedId.split(":");

  if (kind === "inf" && id) {
    const creator = await getUnifiedCreatorById(supabase, unifiedId);
    if (!creator) return null;

    const accounts = creator.platforms ?? [];
    const account =
      (input.platformAccountId
        ? accounts.find((a) => a.id === input.platformAccountId)
        : null) ?? accounts[0];

    if (!account) return null;
    const platform = account.platform;
    if (!isSocialPlatform(platform)) return null;

    const username = normalizeUsername(account.handle ?? "");
    if (!username) return null;

    const profileUrl =
      account.profile_url?.trim() ||
      buildCanonicalProfileUrl(platform as SocialPlatform, username);

    return {
      unifiedId,
      platform: platform as SocialPlatform,
      username,
      profileUrl,
      influencerId: creator.influencer_id ?? id,
      discoveredProfileId: creator.discovered_profile_id ?? null,
      platformAccountId: account.id,
    };
  }

  if (kind === "dis" && id) {
    const { data: profile, error } = await supabase
      .from("discovered_profiles")
      .select("id, platform, username, profile_url, influencer_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !profile) return null;

    const platform = profile.platform;
    if (!isSocialPlatform(platform)) return null;

    const username = normalizeUsername(profile.username ?? "");
    if (!username) return null;

    const profileUrl =
      profile.profile_url?.trim() ||
      buildCanonicalProfileUrl(platform as SocialPlatform, username);

    let platformAccountId: string | null = null;
    if (profile.influencer_id) {
      const { data: account } = await supabase
        .from("influencer_platform_accounts")
        .select("id")
        .eq("influencer_id", profile.influencer_id)
        .eq("platform", platform)
        .eq("normalized_username", username)
        .maybeSingle();
      platformAccountId = account?.id ?? null;
    }

    return {
      unifiedId,
      platform: platform as SocialPlatform,
      username,
      profileUrl,
      influencerId: profile.influencer_id,
      discoveredProfileId: profile.id,
      platformAccountId,
    };
  }

  return null;
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
