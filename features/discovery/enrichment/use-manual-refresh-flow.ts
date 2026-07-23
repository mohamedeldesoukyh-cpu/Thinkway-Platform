"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import type { ManualRefreshCacheAssessment } from "@/lib/creator-enrichment/manual-refresh-cache-assessment";
import type { ManualRefreshDataSource } from "@/lib/creator-enrichment/manual-refresh-policy";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";

import {
  getManualRefreshCacheAssessmentAction,
  type EnrichmentActionResult,
} from "./actions";
import { pollCreatorAfterRefresh } from "./poll-creator-refresh";
import {
  resolveCreatorEnrichmentStatus,
  syncStatusToEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "./status";

const SCOPE_LABELS: Record<EnrichmentScope, string> = {
  metrics: "Metrics",
  avatar: "Avatar",
  profile: "Profile",
  audience: "Audience",
  categories: "Categories",
  all: "All creator data",
};

export type ManualRefreshAction = (
  influencerId: string,
  dataSource?: ManualRefreshDataSource
) => Promise<EnrichmentActionResult>;

export type ManualRefreshRequest = {
  influencerId: string;
  unifiedId?: string | null;
  scope: EnrichmentScope;
  platformAccountId?: string | null;
  refreshAction: ManualRefreshAction;
  onStatusChange?: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export type UseManualRefreshFlowOptions = {
  onStatusChange?: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function useManualRefreshFlow(options: UseManualRefreshFlowOptions = {}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assessment, setAssessment] = useState<ManualRefreshCacheAssessment | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ManualRefreshRequest | null>(null);

  const completeRefresh = useCallback(
    (request: ManualRefreshRequest, result: EnrichmentActionResult) => {
      const notifyStatus = request.onStatusChange ?? options.onStatusChange;
      const notifyUpdated = request.onCreatorUpdated ?? options.onCreatorUpdated;

      logManualRefreshTrace("ui_complete", {
        influencerId: request.influencerId,
        unifiedId: request.unifiedId ?? null,
        scope: request.scope,
        ok: result.ok,
        queued: result.queued,
        message: result.message,
        refreshSource: result.refreshSource ?? null,
        willPoll: Boolean(result.queued && request.unifiedId),
      });

      if (result.refreshSource === "cached_snapshot" && result.ok && !result.queued) {
        notifyStatus?.("enriched");
        toast.success("Creator updated from cached snapshot");
        if (request.unifiedId) {
          logManualRefreshTrace("ui_poll_start", {
            influencerId: request.influencerId,
            unifiedId: request.unifiedId,
            reason: "cached_snapshot",
          });
          void pollCreatorAfterRefresh(
            { unifiedId: request.unifiedId, influencerId: request.influencerId },
            {
              onUpdated: (creator) => {
                notifyUpdated?.(creator);
                notifyStatus?.(resolveCreatorEnrichmentStatus(creator.enrichment_status));
              },
            }
          );
        }
        return;
      }

      if (result.queued) {
        notifyStatus?.("queued");
        if (request.unifiedId) {
          logManualRefreshTrace("ui_poll_start", {
            influencerId: request.influencerId,
            unifiedId: request.unifiedId,
            reason: "queued",
          });
          void pollCreatorAfterRefresh(
            { unifiedId: request.unifiedId, influencerId: request.influencerId },
            {
              onStatusChange: (syncStatus) => {
                logManualRefreshTrace("ui_poll_status", {
                  influencerId: request.influencerId,
                  syncStatus,
                });
                notifyStatus?.(syncStatusToEnrichmentStatus(syncStatus));
              },
              onUpdated: (creator) => {
                notifyUpdated?.(creator);
                notifyStatus?.(resolveCreatorEnrichmentStatus(creator.enrichment_status));
              },
              onComplete: (syncStatus) => {
                logManualRefreshTrace("ui_poll_complete", {
                  influencerId: request.influencerId,
                  syncStatus,
                });
                const next = syncStatusToEnrichmentStatus(syncStatus);
                notifyStatus?.(next);
                if (syncStatus === "completed") {
                  toast.success(
                    result.refreshSource === "live_apify"
                      ? "Creator refreshed live from Apify"
                      : "Creator metrics updated"
                  );
                } else if (syncStatus === "failed") {
                  toast.error("Creator refresh stopped", {
                    description:
                      "No completion from the enrichment worker. Confirm discovery-worker is running, then try Refresh Metrics once.",
                  });
                }
              },
            }
          );
        } else {
          logManualRefreshTrace("ui_poll_complete", {
            influencerId: request.influencerId,
            syncStatus: "skipped_no_unified_id",
            note: "queued=true but unifiedId missing — UI status can stay queued indefinitely",
          });
        }
        return;
      }

      toast.error("Could not refresh", { description: result.message });
    },
    [options.onCreatorUpdated, options.onStatusChange]
  );

  const executeRefresh = useCallback(
    (request: ManualRefreshRequest, dataSource: ManualRefreshDataSource) => {
      startTransition(async () => {
        logManualRefreshTrace("ui_execute", {
          influencerId: request.influencerId,
          unifiedId: request.unifiedId ?? null,
          scope: request.scope,
          dataSource,
        });
        const result = await request.refreshAction(request.influencerId, dataSource);
        setDialogOpen(false);
        setAssessment(null);
        setPendingRequest(null);
        completeRefresh(request, result);
      });
    },
    [completeRefresh]
  );

  const requestRefresh = useCallback(
    (request: ManualRefreshRequest) => {
      startTransition(async () => {
        logManualRefreshTrace("ui_click", {
          influencerId: request.influencerId,
          unifiedId: request.unifiedId ?? null,
          scope: request.scope,
          platformAccountId: request.platformAccountId ?? null,
        });
        logManualRefreshTrace("ui_cache_assess", {
          influencerId: request.influencerId,
          scope: request.scope,
        });
        const preview = await getManualRefreshCacheAssessmentAction({
          influencerId: request.influencerId,
          scope: request.scope,
          platformAccountId: request.platformAccountId,
        });

        if (!preview.ok) {
          logManualRefreshTrace("ui_complete", {
            influencerId: request.influencerId,
            ok: false,
            queued: false,
            message: preview.message,
            stage: "cache_assess",
          });
          toast.error("Could not assess refresh cache", { description: preview.message });
          return;
        }

        if (preview.assessment.shouldPrompt) {
          logManualRefreshTrace("ui_cache_assess", {
            influencerId: request.influencerId,
            shouldPrompt: true,
            reason: preview.assessment.reason,
          });
          setPendingRequest(request);
          setAssessment(preview.assessment);
          setDialogOpen(true);
          return;
        }

        executeRefresh(request, "live_apify");
      });
    },
    [executeRefresh]
  );

  return {
    isPending,
    dialogOpen,
    setDialogOpen,
    assessment,
    scopeLabel: pendingRequest ? SCOPE_LABELS[pendingRequest.scope] : "Creator data",
    requestRefresh,
    chooseRefreshSource: (dataSource: ManualRefreshDataSource) => {
      if (!pendingRequest) return;
      executeRefresh(pendingRequest, dataSource);
    },
  };
}
