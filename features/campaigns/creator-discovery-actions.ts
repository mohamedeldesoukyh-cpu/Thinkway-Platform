"use server";

import { revalidatePath } from "next/cache";

import {
  addCreatorToCampaignShortlist,
  getCampaignShortlistCreators,
  removeFromCampaignShortlist,
  shortlistToCsv,
} from "@/lib/creators/campaign-shortlist";
import { matchCreatorsForCampaign } from "@/lib/creators/campaign-match";
import { findSimilarCreators } from "@/lib/creators/similar-creators";
import { loadCreatorHistoricalMetrics } from "@/lib/creators/historical-metrics";
import { loadCreatorHoverDetails } from "@/lib/creators/creator-hover-details";
import { browseUnifiedCreators, getUnifiedCreatorById, resolveCreatorFromRefLookup, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import { dedupeCreatorIds } from "@/lib/creators/dedupe-creators";
import { STUDIO_CREATOR_HYDRATION_LIMIT } from "@/features/campaign-studio/constants/hydration-limits";
import type { UnifiedCreatorBrowseFilters, UnifiedCreatorResult } from "@/lib/creators/types";
import { createDiscoverySearchPerf } from "@/lib/creators/discovery-search-perf";
import { searchTrace } from "@/lib/creators/search-trace";
import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import type { BrowseInvocationTrace } from "@/lib/discovery/browse-invocation-trace";
import {
  traceAcquisitionPollServer,
  traceBrowseInvocationServer,
} from "@/lib/discovery/browse-invocation-trace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  cancelAcquisitionSession,
  getAcquisitionSessionConfig,
  touchAcquisitionSessionHeartbeat,
} from "@/lib/discovery/acquisition-session";

async function requireUserId() {
  const perf = createDiscoverySearchPerf("browseUnifiedCreatorsAction.auth");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  perf?.end();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export type AcquisitionJobStatusResult = {
  jobId: string;
  status: string;
  profilesAdded: number;
  importedInfluencerIds: string[];
  errorMessage: string | null;
  completed: boolean;
  failed: boolean;
  cancelled: boolean;
};

function parseImportedInfluencerIds(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const ids = (result as { imported_influencer_ids?: unknown }).imported_influencer_ids;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

export async function getAcquisitionJobsStatusAction(
  jobIds: string[]
): Promise<AcquisitionJobStatusResult | null> {
  const uniqueIds = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return null;

  const statuses = await Promise.all(
    uniqueIds.map((jobId) => getAcquisitionJobStatusAction(jobId))
  );
  const resolved = statuses.filter(
    (status): status is AcquisitionJobStatusResult => status != null
  );
  if (resolved.length === 0) return null;

  const importedInfluencerIds = [
    ...new Set(resolved.flatMap((status) => status.importedInfluencerIds)),
  ];
  const profilesAdded = resolved.reduce((sum, status) => sum + status.profilesAdded, 0);
  const allCompleted = resolved.every((status) => status.completed);
  const allFailed = resolved.every((status) => status.failed);
  const allCancelled = resolved.every((status) => status.cancelled);
  const anyRunning = resolved.some((status) => status.status === "running");
  const aggregateStatus = allCompleted
    ? "completed"
    : allCancelled
      ? "cancelled"
      : allFailed
      ? "failed"
      : anyRunning
        ? "running"
        : resolved[0]?.status ?? "pending";

  const errorMessages = resolved
    .filter((status) => (status.failed || status.cancelled) && status.errorMessage)
    .map((status) => status.errorMessage as string);

  return {
    jobId: uniqueIds.join(","),
    status: aggregateStatus,
    profilesAdded,
    importedInfluencerIds,
    errorMessage:
      allCancelled
        ? "Search cancelled."
        : allFailed && errorMessages.length > 0
        ? errorMessages.join(" · ")
        : !allCompleted && resolved.some((s) => s.failed)
          ? `Some platforms failed: ${errorMessages.join(" · ")}`
          : null,
    completed: allCompleted || (profilesAdded > 0 && resolved.every((s) => s.completed || s.failed || s.cancelled)),
    failed: allFailed,
    cancelled: allCancelled,
  };
}

export async function getAcquisitionJobStatusAction(
  jobId: string
): Promise<AcquisitionJobStatusResult | null> {
  if (!jobId?.trim()) return null;
  const { supabase } = await requireUserId();
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("id, status, profiles_discovered, error_message, result")
    .eq("id", jobId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const status = String(data.status ?? "pending");
  const importedInfluencerIds = parseImportedInfluencerIds(data.result);
  traceAcquisitionPollServer(jobId.trim(), status, {
    profilesAdded: Number(data.profiles_discovered ?? 0),
    failed: status === "failed",
    cancelled: status === "cancelled",
    completed: status === "completed",
  });
  return {
    jobId: data.id as string,
    status,
    profilesAdded: Number(data.profiles_discovered ?? 0),
    importedInfluencerIds,
    errorMessage: (data.error_message as string | null) ?? null,
    completed: status === "completed",
    failed: status === "failed",
    cancelled: status === "cancelled",
  };
}

export async function acquisitionSessionHeartbeatAction(
  searchSessionId: string
): Promise<{ ok: boolean; heartbeatIntervalMs: number }> {
  await requireUserId();
  const ok = await touchAcquisitionSessionHeartbeat(searchSessionId);
  return { ok, heartbeatIntervalMs: getAcquisitionSessionConfig().heartbeatIntervalMs };
}

export async function cancelAcquisitionSessionAction(searchSessionId: string) {
  const { supabase } = await requireUserId();
  return cancelAcquisitionSession(supabase, searchSessionId, {
    reason: "Cancelled — search session ended.",
  });
}

export async function browseCreatorsByInfluencerIdsAction(
  influencerIds: string[]
): Promise<UnifiedCreatorResult[]> {
  const uniqueIds = [...new Set(influencerIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { supabase } = await requireUserId();
  const result = await browseUnifiedCreators(
    supabase,
    {
      influencerIds: uniqueIds,
      page: 1,
      pageSize: uniqueIds.length,
      productionOnly: true,
    },
    "discovery"
  );
  return result.creators;
}

export async function browseUnifiedCreatorsAction(
  filters: UnifiedCreatorBrowseFilters,
  invocation?: BrowseInvocationTrace
) {
  traceBrowseInvocationServer(invocation ?? { caller: "unknown" }, {
    skipCoverageBackfill: filters.skipCoverageBackfill ?? false,
    page: filters.page ?? 1,
  });
  const { supabase } = await requireUserId();
  searchTrace("3_unified_browse_filters", { browseFilters: filters }, { path: "discovery" });
  const result = await browseUnifiedCreatorsWithCoverageBackfill(supabase, filters, "discovery");
  searchTrace("9_final_creator_count", {
    total: result.total,
    creatorCount: result.creators.length,
    internal_count: result.internal_count,
    discovery_count: result.discovery_count,
    coverage_level: result.coverage?.coverageLevel ?? null,
    backfill_queued: result.backfill?.queued ?? false,
    backfill_completed: result.backfill?.completed ?? false,
  }, { path: "discovery" });
  return result;
}

export async function getUnifiedCreatorDetailAction(unifiedId: string) {
  if (!unifiedId?.trim()) return null;
  const { supabase } = await requireUserId();
  return getUnifiedCreatorById(supabase, unifiedId.trim());
}

/** Lightweight stats for discovery avatar hover card (2s delay). */
export async function getCreatorHoverDetailsAction(unifiedId: string) {
  if (!unifiedId?.trim()) return null;
  const { supabase, userId } = await requireUserId();
  const creator = await getUnifiedCreatorById(supabase, unifiedId.trim());
  if (!creator) return null;
  return loadCreatorHoverDetails(supabase, userId, creator);
}

function normalizeUnifiedCreatorId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("inf:") || trimmed.startsWith("dis:")) return trimmed;
  return `inf:${trimmed}`;
}

/** Batch creator lookup — one server round-trip instead of N detail actions. */
export async function getUnifiedCreatorsBatchAction(creatorIds: string[]) {
  const ids = dedupeCreatorIds(creatorIds)
    .filter(Boolean)
    .slice(0, STUDIO_CREATOR_HYDRATION_LIMIT);
  if (ids.length === 0) return [];

  const { supabase } = await requireUserId();
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: ids.map(normalizeUnifiedCreatorId),
    influencerIds: ids
      .map((id) => {
        if (id.startsWith("inf:")) return id.slice(4);
        if (id.startsWith("dis:")) return null;
        return id;
      })
      .filter((id): id is string => Boolean(id)),
    discoveredProfileIds: ids
      .map((id) => (id.startsWith("dis:") ? id.slice(4) : null))
      .filter((id): id is string => Boolean(id)),
  });

  const results: UnifiedCreatorResult[] = [];
  for (const id of ids) {
    const creator = resolveCreatorFromRefLookup(lookup, {
      unified_id: normalizeUnifiedCreatorId(id),
      influencer_id: id.startsWith("inf:") ? id.slice(4) : id.startsWith("dis:") ? null : id,
      profile_id: id.startsWith("dis:") ? id.slice(4) : null,
    });
    if (creator) results.push(creator);
  }
  return results;
}

export async function addCreatorToCampaignShortlistAction(
  campaignHeaderId: string,
  creator: UnifiedCreatorResult,
  notes?: string
) {
  const { supabase, userId } = await requireUserId();
  await addCreatorToCampaignShortlist(supabase, {
    campaignHeaderId,
    ownerId: userId,
    creator,
    notes,
  });
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

export async function removeCreatorFromShortlistAction(
  campaignHeaderId: string,
  itemId: string
) {
  const { supabase } = await requireUserId();
  await removeFromCampaignShortlist(supabase, itemId);
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

export async function getCampaignShortlistAction(campaignHeaderId: string) {
  const { supabase } = await requireUserId();
  return getCampaignShortlistCreators(supabase, campaignHeaderId);
}

export async function exportCampaignShortlistCsvAction(campaignHeaderId: string) {
  const { supabase } = await requireUserId();
  const rows = await getCampaignShortlistCreators(supabase, campaignHeaderId);
  return shortlistToCsv(rows);
}

export async function matchCampaignCreatorsAction(input: {
  campaignHeaderId: string;
  brief: string;
  platform?: string;
  country?: string;
  limit?: number;
}) {
  const { supabase, userId } = await requireUserId();
  return matchCreatorsForCampaign(supabase, {
    ...input,
    createdBy: userId,
  });
}

export async function getSimilarCreatorsAction(unifiedId: string, limit = 8) {
  const { supabase } = await requireUserId();
  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) return [];
  return findSimilarCreators(supabase, creator, limit);
}

export async function getCreatorHistoricalMetricsAction(unifiedId: string) {
  const { supabase } = await requireUserId();
  return loadCreatorHistoricalMetrics(supabase, unifiedId);
}
