/**
 * Immutable snapshot persistence — raw + normalized, versioned.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";

import { computeExpiresAt, resolveRefreshTtlDays } from "./refresh-policy-service";
import { bridgeSnapshotToCreatorDna } from "./dna-bridge";
import type {
  IplProvider,
  NormalizedProfileSnapshot,
  RawProviderPayload,
} from "../types";

type AnySupabase = SupabaseClient;

export type PersistSnapshotInput = {
  providerRunId?: string | null;
  influencerId?: string | null;
  platformAccountId?: string | null;
  discoveredProfileId?: string | null;
  provider: IplProvider;
  platform: string;
  profileUrl?: string | null;
  rawSnapshot: RawProviderPayload;
  normalizedSnapshot: ApifyProfileData;
  followerCount?: number | null;
  auditMetadata?: Record<string, unknown>;
  snapshotType?: string;
  /** When false, caller must invoke bridgeSnapshotToCreatorDna (e.g. after avatar upload). */
  awaitDnaBridge?: boolean;
};

export async function persistSnapshot(
  supabase: AnySupabase,
  input: PersistSnapshotInput
): Promise<string | null> {
  try {
    const fetchedAt = new Date().toISOString();
    const ttlDays = await resolveRefreshTtlDays(supabase, {
      provider: input.provider,
      fieldGroup: "all",
      followerCount: input.followerCount ?? input.normalizedSnapshot.followers,
    });
    const expiresAt = computeExpiresAt(fetchedAt, ttlDays);

    const normalized: NormalizedProfileSnapshot = {
      ...input.normalizedSnapshot,
      provider: input.provider,
      fetchedAt,
    };

    const { data, error } = await supabase
      .from("ipl_snapshots")
      .insert({
        provider_run_id: input.providerRunId ?? null,
        influencer_id: input.influencerId ?? null,
        platform_account_id: input.platformAccountId ?? null,
        discovered_profile_id: input.discoveredProfileId ?? null,
        provider: input.provider,
        platform: input.platform,
        profile_url: input.profileUrl ?? null,
        raw_snapshot: input.rawSnapshot as never,
        normalized_snapshot: normalized as never,
        snapshot_type: input.snapshotType ?? "profile",
        fetched_at: fetchedAt,
        expires_at: expiresAt,
        is_latest: true,
        audit_metadata: input.auditMetadata ?? {},
      } as never)
      .select("id, snapshot_version")
      .maybeSingle();

    if (error) {
      console.error("[ipl] snapshot insert failed", error.message);
      return null;
    }

    const row = data as { id: string; snapshot_version: number } | null;
    if (row) {
      console.log("[ipl] snapshot persisted", {
        snapshotId: row.id,
        version: row.snapshot_version,
        provider: input.provider,
        platform: input.platform,
      });

      const enrichmentRunId =
        typeof input.auditMetadata?.enrichment_run_id === "string"
          ? input.auditMetadata.enrichment_run_id
          : null;

      if (input.awaitDnaBridge !== false) {
        const bridgeResult = await bridgeSnapshotToCreatorDna(supabase, row.id, {
          enrichmentRunId,
        });
        if (!bridgeResult.ok) {
          console.error("[ipl] DNA bridge failed after snapshot persist", {
            snapshotId: row.id,
            message: bridgeResult.message,
          });
        }
      }
    }
    return row?.id ?? null;
  } catch (error) {
    console.error(
      "[ipl] snapshot insert threw",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export type LatestSnapshotLookup = {
  provider: IplProvider;
  platformAccountId: string;
  force?: boolean;
};

export async function findLatestFreshSnapshot(
  supabase: AnySupabase,
  input: LatestSnapshotLookup
): Promise<{
  id: string;
  normalized: NormalizedProfileSnapshot;
  fetchedAt: string;
  expiresAt: string | null;
  snapshotVersion: number;
} | null> {
  if (input.force) return null;

  const { data, error } = await supabase
    .from("ipl_snapshots")
    .select("id, normalized_snapshot, fetched_at, expires_at, snapshot_version")
    .eq("platform_account_id", input.platformAccountId)
    .eq("provider", input.provider)
    .eq("is_latest", true)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    normalized_snapshot: NormalizedProfileSnapshot;
    fetched_at: string;
    expires_at: string | null;
    snapshot_version: number;
  };

  const now = Date.now();
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (!Number.isNaN(exp) && now >= exp) return null;
  } else {
    return null;
  }

  return {
    id: row.id,
    normalized: row.normalized_snapshot,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    snapshotVersion: row.snapshot_version,
  };
}

export async function getSnapshotById(
  supabase: AnySupabase,
  snapshotId: string
): Promise<{
  id: string;
  normalized: NormalizedProfileSnapshot;
  raw: RawProviderPayload;
  snapshotVersion: number;
  platformAccountId: string | null;
  influencerId: string | null;
  discoveredProfileId: string | null;
} | null> {
  const { data, error } = await supabase
    .from("ipl_snapshots")
    .select(
      "id, normalized_snapshot, raw_snapshot, snapshot_version, platform_account_id, influencer_id, discovered_profile_id"
    )
    .eq("id", snapshotId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    normalized_snapshot: NormalizedProfileSnapshot;
    raw_snapshot: RawProviderPayload;
    snapshot_version: number;
    platform_account_id: string | null;
    influencer_id: string | null;
    discovered_profile_id: string | null;
  };

  return {
    id: row.id,
    normalized: row.normalized_snapshot,
    raw: row.raw_snapshot,
    snapshotVersion: row.snapshot_version,
    platformAccountId: row.platform_account_id,
    influencerId: row.influencer_id,
    discoveredProfileId: row.discovered_profile_id,
  };
}
