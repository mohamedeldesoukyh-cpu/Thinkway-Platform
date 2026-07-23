"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import { refreshCreatorAction } from "../actions";
import { pollCreatorAfterRefresh } from "../poll-creator-refresh";
import {
  formatLastUpdated,
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
  syncStatusToEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "../status";
import { useManualRefreshFlow } from "../use-manual-refresh-flow";
import { ManualRefreshConfirmDialog } from "./manual-refresh-confirm-dialog";

/**
 * Self-contained "Refresh Creator" control (spec §1/§3, priority 4).
 * Prompts for cache vs live Apify when recent IPL snapshots exist.
 */
export function RefreshCreatorButton({
  influencerId,
  unifiedId,
  lastEnrichedAt,
  enrichmentStatus: enrichmentStatusProp,
  size = "sm",
  variant = "outline",
  showTimestamp = true,
  className,
  onQueued,
  onStatusChange,
  onCreatorUpdated,
}: {
  influencerId: string;
  unifiedId?: string | null;
  lastEnrichedAt?: string | null;
  enrichmentStatus?: CreatorEnrichmentStatus | null;
  size?: "xs" | "sm" | "default";
  variant?: "outline" | "ghost" | "secondary" | "default";
  showTimestamp?: boolean;
  className?: string;
  onQueued?: () => void;
  onStatusChange?: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
}) {
  const [localStatus, setLocalStatus] = useState<CreatorEnrichmentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollActiveRef = useRef(false);

  const {
    isPending,
    dialogOpen,
    setDialogOpen,
    assessment,
    scopeLabel,
    requestRefresh,
    chooseRefreshSource,
  } = useManualRefreshFlow({
    onStatusChange: (status) => {
      setLocalStatus(status);
      onStatusChange?.(status);
      if (status === "queued") onQueued?.();
    },
    onCreatorUpdated,
  });

  const displayStatus = resolveCreatorEnrichmentStatus(localStatus ?? enrichmentStatusProp);
  const inProgress = isPending || isEnrichmentInProgress(displayStatus) || isPolling;
  const isCollecting = displayStatus === "running" || (isPending && displayStatus === "queued");

  function beginPoll() {
    if (!unifiedId || pollActiveRef.current) return;
    pollActiveRef.current = true;
    setIsPolling(true);

    void pollCreatorAfterRefresh(
      { unifiedId, influencerId },
      {
        onStatusChange: (syncStatus) => {
          const next = syncStatusToEnrichmentStatus(syncStatus);
          setLocalStatus(next);
          onStatusChange?.(next);
        },
        onUpdated: (creator) => {
          setLocalStatus(resolveCreatorEnrichmentStatus(creator.enrichment_status));
          onCreatorUpdated?.(creator);
        },
        onComplete: (syncStatus) => {
          pollActiveRef.current = false;
          setIsPolling(false);
          const next = syncStatusToEnrichmentStatus(syncStatus);
          setLocalStatus(next);
          onStatusChange?.(next);
        },
      }
    ).finally(() => {
      pollActiveRef.current = false;
      setIsPolling(false);
    });
  }

  useEffect(() => {
    const status = resolveCreatorEnrichmentStatus(enrichmentStatusProp);
    if (!isEnrichmentInProgress(status)) {
      setLocalStatus(null);
      setIsPolling(false);
      pollActiveRef.current = false;
    }
  }, [enrichmentStatusProp]);

  useEffect(() => {
    if (!unifiedId || !influencerId) return;
    const status = resolveCreatorEnrichmentStatus(enrichmentStatusProp);
    if (!isEnrichmentInProgress(status)) return;
    // Resume at most one poll loop — do not restart on every queued→running flicker.
    if (pollActiveRef.current) return;
    beginPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume poll when creator id changes
  }, [enrichmentStatusProp, influencerId, unifiedId]);

  function handleClick() {
    requestRefresh({
      influencerId,
      unifiedId,
      scope: "metrics",
      refreshAction: refreshCreatorAction,
      onStatusChange: (status) => {
        setLocalStatus(status);
        onStatusChange?.(status);
        if (status === "queued") onQueued?.();
      },
      onCreatorUpdated,
    });
  }

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          size={size}
          variant={variant}
          onClick={handleClick}
          disabled={inProgress}
        >
          {isCollecting || isPolling || isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <RefreshCwIcon aria-hidden />
          )}
          {displayStatus === "queued"
            ? "Queued"
            : displayStatus === "running"
              ? "Collecting"
              : "Refresh Metrics"}
        </Button>
        {showTimestamp ? (
          <span className="text-xs text-muted-foreground">
            Last updated {formatLastUpdated(lastEnrichedAt)}
          </span>
        ) : null}
      </div>

      <ManualRefreshConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        assessment={assessment}
        scopeLabel={scopeLabel}
        isSubmitting={isPending}
        onChoose={chooseRefreshSource}
      />
    </>
  );
}
