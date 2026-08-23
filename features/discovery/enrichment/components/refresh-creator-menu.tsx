"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import {
  refreshCreatorAction,
  refreshCreatorAllAction,
  refreshCreatorAudienceAction,
  refreshCreatorAvatarAction,
  refreshCreatorCategoriesAction,
  refreshCreatorProfileAction,
} from "../actions";
import { pollCreatorAfterRefresh } from "../poll-creator-refresh";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
  syncStatusToEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "../status";
import { useManualRefreshFlow } from "../use-manual-refresh-flow";
import { ManualRefreshConfirmDialog } from "./manual-refresh-confirm-dialog";

const REFRESH_OPTIONS: Array<{
  scope: EnrichmentScope;
  label: string;
  action: typeof refreshCreatorAction;
}> = [
  { scope: "metrics", label: "Refresh Metrics", action: refreshCreatorAction },
  { scope: "avatar", label: "Refresh Avatar", action: refreshCreatorAvatarAction },
  { scope: "profile", label: "Refresh Profile", action: refreshCreatorProfileAction },
  { scope: "audience", label: "Refresh Audience", action: refreshCreatorAudienceAction },
  { scope: "categories", label: "Refresh Categories", action: refreshCreatorCategoriesAction },
  { scope: "all", label: "Refresh All", action: refreshCreatorAllAction },
];

type RefreshCreatorMenuProps = {
  influencerId: string;
  unifiedId?: string | null;
  enrichmentStatus?: CreatorEnrichmentStatus | null;
  size?: "xs" | "sm" | "default";
  variant?: "outline" | "ghost" | "secondary" | "default";
  className?: string;
  onStatusChange?: (status: CreatorEnrichmentStatus) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function RefreshCreatorMenu({
  influencerId,
  unifiedId,
  enrichmentStatus,
  size = "sm",
  variant = "outline",
  className,
  onStatusChange,
  onCreatorUpdated,
}: RefreshCreatorMenuProps) {
  const displayStatus = resolveCreatorEnrichmentStatus(enrichmentStatus);
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
    onStatusChange,
    onCreatorUpdated,
  });
  const inProgress = isPending || isEnrichmentInProgress(displayStatus);

  useEffect(() => {
    if (!unifiedId || !influencerId) return;
    if (!isEnrichmentInProgress(displayStatus)) {
      pollActiveRef.current = false;
      return;
    }
    if (pollActiveRef.current) return;
    pollActiveRef.current = true;

    void pollCreatorAfterRefresh(
      { unifiedId, influencerId },
      {
        onStatusChange: (syncStatus) => {
          onStatusChange?.(syncStatusToEnrichmentStatus(syncStatus));
        },
        onUpdated: (creator) => {
          onCreatorUpdated?.(creator);
          onStatusChange?.(resolveCreatorEnrichmentStatus(creator.enrichment_status));
        },
        onComplete: (syncStatus) => {
          pollActiveRef.current = false;
          onStatusChange?.(syncStatusToEnrichmentStatus(syncStatus));
        },
      }
    ).catch(() => {
      pollActiveRef.current = false;
      onStatusChange?.("failed");
    });
  }, [displayStatus, influencerId, onCreatorUpdated, onStatusChange, unifiedId]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size={size}
            variant={variant}
            disabled={inProgress}
            className={cn("gap-1", className)}
          >
            {inProgress ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCwIcon aria-hidden />
            )}
            Refresh
            <ChevronDownIcon className="opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {REFRESH_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.scope}
              onClick={() =>
                requestRefresh({
                  influencerId,
                  unifiedId,
                  scope: option.scope,
                  refreshAction: option.action,
                  onStatusChange,
                  onCreatorUpdated,
                })
              }
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
