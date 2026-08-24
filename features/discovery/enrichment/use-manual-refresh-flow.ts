"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import type { ManualRefreshCacheAssessment } from "@/lib/creator-enrichment/manual-refresh-cache-assessment";
import type { ManualRefreshDataSource } from "@/lib/creator-enrichment/manual-refresh-policy";
import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";
import { resolveManualRefreshToast } from "@/lib/creator-enrichment/refresh-failure-stage";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  getManualRefreshCacheAssessmentAction,
  type EnrichmentActionResult,
} from "./actions";
import { resolveManualRefreshFollowUp } from "./manual-refresh-follow-up";
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

      const followUp = resolveManualRefreshFollowUp({
        result,
        unifiedId: request.unifiedId,
      });

      logManualRefreshTrace("ui_complete", {
        influencerId: request.influencerId,
        unifiedId: request.unifiedId ?? null,
        scope: request.scope,
        ok: result.ok,
        queued: result.queued,
        message: result.message,
        refreshSource: result.refreshSource ?? null,
        followUp: followUp.type,
        willPoll: followUp.type === "poll",
      });

      if (followUp.type === "cached") {
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
          ).catch(() => {
            notifyStatus?.("failed");
          });
        }
        return;
      }

      if (followUp.type === "completed") {
        notifyStatus?.("enriched");
        const toastContent = resolveManualRefreshToast({
          syncStatus: "completed",
          refreshSource: result.refreshSource,
          enrichmentSource: result.refreshSource === "live_apify" ? "apify" : null,
          enrichmentStatus: "enriched",
        });
        logManualRefreshTrace("ui_success_toast", {
          influencerId: request.influencerId,
          toast: toastContent.title,
          tone: toastContent.tone,
          refreshSourceIntent: result.refreshSource ?? null,
          followUp: "completed",
        });
        if (toastContent.tone === "success") {
          toast.success(toastContent.title, { description: toastContent.description });
        } else if (toastContent.tone === "error") {
          toast.error(toastContent.title, { description: toastContent.description });
        } else {
          toast.message(toastContent.title, { description: toastContent.description });
        }
        if (request.unifiedId) {
          void pollCreatorAfterRefresh(
            { unifiedId: request.unifiedId, influencerId: request.influencerId },
            {
              onUpdated: (creator) => {
                notifyUpdated?.(creator);
                notifyStatus?.(resolveCreatorEnrichmentStatus(creator.enrichment_status));
              },
            }
          ).catch(() => {
            notifyStatus?.("failed");
          });
        }
        return;
      }

      if (followUp.type === "queued_without_unified_id") {
        notifyStatus?.("failed");
        toast.error("Could not refresh metrics", {
          description: "This creator is missing a linked profile id, so refresh cannot be tracked.",
        });
        return;
      }

      if (followUp.type === "poll" && request.unifiedId) {
        notifyStatus?.("queued");
        logManualRefreshTrace("ui_poll_start", {
          influencerId: request.influencerId,
          unifiedId: request.unifiedId,
          reason: result.queued ? "queued" : "already_in_progress",
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
            onComplete: (syncStatus, creator, poll) => {
              logManualRefreshTrace("ui_poll_complete", {
                influencerId: request.influencerId,
                syncStatus,
                enrichmentStatus: creator?.enrichment_status ?? poll?.enrichmentStatus ?? null,
                enrichmentSource: creator?.enrichment_source ?? poll?.enrichmentSource ?? null,
                failureStage: poll?.failureStage ?? null,
                refreshId: poll?.refreshId ?? null,
              });
              const next = syncStatusToEnrichmentStatus(syncStatus);
              notifyStatus?.(next);
              if (syncStatus === "completed" || syncStatus === "failed") {
                const toastContent = resolveManualRefreshToast({
                  syncStatus,
                  refreshSource: result.refreshSource,
                  enrichmentSource:
                    creator?.enrichment_source ?? poll?.enrichmentSource ?? null,
                  enrichmentStatus:
                    creator?.enrichment_status ?? poll?.enrichmentStatus ?? null,
                  failureStage: poll?.failureStage ?? null,
                  failureReason: poll?.failureReason ?? null,
                });
                logManualRefreshTrace("ui_success_toast", {
                  influencerId: request.influencerId,
                  toast: toastContent.title,
                  tone: toastContent.tone,
                  refreshSourceIntent: result.refreshSource ?? null,
                  enrichmentStatus:
                    creator?.enrichment_status ?? poll?.enrichmentStatus ?? null,
                  enrichmentSource:
                    creator?.enrichment_source ?? poll?.enrichmentSource ?? null,
                  syncStatus,
                  failureStage: poll?.failureStage ?? null,
                  refreshId: poll?.refreshId ?? null,
                });
                if (toastContent.tone === "success") {
                  toast.success(toastContent.title, {
                    description: toastContent.description,
                  });
                } else if (toastContent.tone === "error") {
                  toast.error(toastContent.title, {
                    description: toastContent.description,
                  });
                } else {
                  toast.message(toastContent.title, {
                    description: toastContent.description,
                  });
                }
              }
            },
          }
        ).catch(() => {
          notifyStatus?.("failed");
          toast.error("Refresh timed out", {
            description: "Metrics refresh did not finish. Try again.",
          });
        });
        return;
      }

      toast.error("Could not refresh", { description: followUp.type === "error" ? followUp.message : result.message });
    },
    [options.onCreatorUpdated, options.onStatusChange]
  );

  const executeRefresh = useCallback(
    (request: ManualRefreshRequest, dataSource: ManualRefreshDataSource) => {
      startTransition(async () => {
        try {
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
        } catch (error) {
          setDialogOpen(false);
          setAssessment(null);
          setPendingRequest(null);
          (request.onStatusChange ?? options.onStatusChange)?.("failed");
          toast.error("Could not refresh", {
            description: error instanceof Error ? error.message : "Refresh failed.",
          });
        }
      });
    },
    [completeRefresh, options.onStatusChange]
  );

  const requestRefresh = useCallback(
    (request: ManualRefreshRequest) => {
      startTransition(async () => {
        try {
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
        } catch (error) {
          toast.error("Could not refresh", {
            description: error instanceof Error ? error.message : "Refresh failed.",
          });
        }
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
