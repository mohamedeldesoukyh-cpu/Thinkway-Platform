"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

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

/**
 * Self-contained "Refresh Creator" control (spec §1/§3, priority 4).
 * Enqueues a forced enrichment job, shows a loading state, and reports the last
 * update time. Designed to be slotted into the creator detail sheet by Phase 2.5
 * without touching shared files.
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
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<CreatorEnrichmentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollActiveRef = useRef(false);

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
          if (syncStatus === "completed") {
            toast.success("Creator metrics updated");
          } else if (syncStatus === "failed") {
            toast.error("Creator refresh failed", {
              description: "Apify enrichment did not complete successfully.",
            });
          }
        },
      }
    ).finally(() => {
      pollActiveRef.current = false;
      setIsPolling(false);
    });
  }

  useEffect(() => {
    if (!unifiedId || !influencerId) return;
    const status = resolveCreatorEnrichmentStatus(enrichmentStatusProp);
    if (!isEnrichmentInProgress(status)) return;
    beginPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume poll when creator id changes
  }, [enrichmentStatusProp, influencerId, unifiedId]);

  function handleClick() {
    startTransition(async () => {
      const result = await refreshCreatorAction(influencerId);
      if (result.queued) {
        setLocalStatus("queued");
        onStatusChange?.("queued");
        onQueued?.();
        beginPoll();
      } else {
        toast.error("Could not refresh", { description: result.message });
      }
    });
  }

  return (
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
          Updated {formatLastUpdated(lastEnrichedAt)}
        </span>
      ) : null}
    </div>
  );
}
