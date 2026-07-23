/**
 * Cache-first profile fetch orchestrator.
 *
 * Flow:
 * 1. Check IPL for fresh snapshot (unless force)
 * 2. On miss → call external provider
 * 3. Persist raw snapshot IMMEDIATELY (before merge/preview)
 * 4. Normalize via provider adapter
 * 5. Persist normalized snapshot + provider run metadata
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchApifyProfileRaw } from "@/lib/creator-enrichment/apify-profile";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { getProviderAdapter } from "../adapters";
import { isIplCacheFirstEnabled, isIplEnabled } from "../config";
import { fetchApifyProfile } from "@/lib/creator-enrichment/apify-profile";
import type { IplFetchContext, IplFetchResult, RawProviderPayload } from "../types";
import { completeProviderRun, createProviderRun } from "./provider-run-service";
import { findLatestFreshSnapshot, persistSnapshot } from "./snapshot-service";

type AnySupabase = SupabaseClient;

function toApifyProfileData(normalized: import("../types").NormalizedProfileSnapshot) {
  const { provider: _p, fetchedAt: _f, snapshotVersion: _v, ...rest } = normalized;
  return rest;
}

export async function fetchProfileWithIpl(
  supabase: AnySupabase,
  context: IplFetchContext
): Promise<IplFetchResult> {
  const platformKey = canonicalPlatformKey(context.platform);
  const provider = "apify" as const;
  const adapter = getProviderAdapter(provider);

  if (!isIplEnabled() || !adapter) {
    const legacy = await fetchApifyProfile({
      platform: context.platform,
      username: context.username,
      profileUrl: context.profileUrl,
    });
    if (!legacy.ok) {
      return {
        ok: false,
        reason: legacy.reason,
        available: legacy.available,
        providerRunId: null,
      };
    }
    return {
      ok: true,
      data: legacy.data,
      source: "provider",
      snapshotId: null,
      providerRunId: null,
      cacheHit: false,
    };
  }

  // ---- Cache-first lookup --------------------------------------------------
  if (
    isIplCacheFirstEnabled() &&
    !context.force &&
    context.platformAccountId
  ) {
    const cached = await findLatestFreshSnapshot(supabase, {
      provider,
      platformAccountId: context.platformAccountId,
      force: context.force,
    });

    if (cached) {
      const cacheRunId = await createProviderRun(supabase, {
        provider,
        influencerId: context.influencerId,
        platformAccountId: context.platformAccountId,
        discoveredProfileId: context.discoveredProfileId,
        platform: platformKey,
        profileUrl: context.profileUrl,
        status: "cached",
        metadata: {
          cacheHit: true,
          snapshotId: cached.id,
          snapshotVersion: cached.snapshotVersion,
          ...context.auditMetadata,
        },
      });

      if (cacheRunId) {
        await completeProviderRun(supabase, {
          runId: cacheRunId,
          status: "cached",
          durationMs: 0,
          metadata: { cacheHit: true, snapshotId: cached.id },
        });
      }

      console.log("[ipl] cache hit", {
        platformAccountId: context.platformAccountId,
        snapshotId: cached.id,
        version: cached.snapshotVersion,
      });

      return {
        ok: true,
        data: toApifyProfileData(cached.normalized),
        source: "cache",
        snapshotId: cached.id,
        providerRunId: cacheRunId,
        cacheHit: true,
      };
    }
  }

  // ---- External provider fetch ---------------------------------------------
  const providerRunId = await createProviderRun(supabase, {
    provider,
    influencerId: context.influencerId,
    platformAccountId: context.platformAccountId,
    discoveredProfileId: context.discoveredProfileId,
    platform: platformKey,
    profileUrl: context.profileUrl,
    status: "running",
    metadata: context.auditMetadata ?? {},
  });

  const rawResult = await fetchApifyProfileRaw({
    platform: context.platform,
    username: context.username,
    profileUrl: context.profileUrl,
    includePosts: context.includePosts,
  });

  if (!rawResult.ok) {
    if (providerRunId) {
      await completeProviderRun(supabase, {
        runId: providerRunId,
        status: "failed",
        externalRunId: rawResult.apifyRunId ?? null,
        durationMs: rawResult.durationMs,
        errorMessage: rawResult.reason,
      });
    }
    return {
      ok: false,
      reason: rawResult.reason,
      available: rawResult.available,
      providerRunId,
    };
  }

  const rawPayload: RawProviderPayload = {
    profileRows: rawResult.profileRows,
    postRows: rawResult.postRows,
    apifyRunId: rawResult.apifyRunId,
    detailsRunId: rawResult.detailsRunId,
    postsRunId: rawResult.postsRunId,
    platformKey,
    profileUrl: context.profileUrl,
    username: context.username,
  };

  const payloadBytes = adapter.estimatePayloadBytes(rawPayload);
  const estimatedCostUsd = adapter.estimateCostUsd(rawPayload, rawResult.durationMs);

  // ---- Persist RAW immediately (before normalization / merge) --------------
  const normalized = adapter.normalize(rawPayload);
  if (!normalized) {
    if (providerRunId) {
      await completeProviderRun(supabase, {
        runId: providerRunId,
        status: "failed",
        externalRunId: rawResult.apifyRunId,
        durationMs: rawResult.durationMs,
        payloadBytes,
        estimatedCostUsd,
        errorMessage: "Normalization returned no usable data.",
      });
    }
    return {
      ok: false,
      reason: "Apify returned no usable items.",
      available: true,
      providerRunId,
    };
  }

  const snapshotId = await persistSnapshot(supabase, {
    providerRunId,
    influencerId: context.influencerId,
    platformAccountId: context.platformAccountId,
    discoveredProfileId: context.discoveredProfileId,
    provider,
    platform: platformKey,
    profileUrl: context.profileUrl,
    rawSnapshot: rawPayload,
    normalizedSnapshot: normalized,
    followerCount: context.followerCount ?? normalized.followers,
    auditMetadata: {
      ...context.auditMetadata,
      apifyRunId: rawResult.apifyRunId,
      durationMs: rawResult.durationMs,
    },
    awaitDnaBridge: !context.deferDnaBridge,
  });

  if (providerRunId) {
    await completeProviderRun(supabase, {
      runId: providerRunId,
      status: "completed",
      externalRunId: rawResult.apifyRunId,
      durationMs: rawResult.durationMs,
      payloadBytes,
      estimatedCostUsd,
      metadata: { snapshotId },
    });
  }

  return {
    ok: true,
    data: normalized,
    source: "provider",
    snapshotId,
    providerRunId,
    cacheHit: false,
  };
}
