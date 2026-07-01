"use client";

import { useTransition } from "react";
import { ChevronDownIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

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
  const [isPending, startTransition] = useTransition();
  const displayStatus = resolveCreatorEnrichmentStatus(enrichmentStatus);
  const inProgress = isPending || isEnrichmentInProgress(displayStatus);

  function runRefresh(action: typeof refreshCreatorAction) {
    startTransition(async () => {
      const result = await action(influencerId);
      if (result.queued) {
        onStatusChange?.("queued");
        if (unifiedId) {
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
                const next = syncStatusToEnrichmentStatus(syncStatus);
                onStatusChange?.(next);
                if (syncStatus === "completed") {
                  toast.success("Creator refresh completed");
                } else if (syncStatus === "failed") {
                  toast.error("Creator refresh failed");
                }
              },
            }
          );
        }
      } else {
        toast.error("Could not refresh", { description: result.message });
      }
    });
  }

  return (
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
            <RefreshCwIcon className="size-3.5" aria-hidden />
          )}
          Refresh
          <ChevronDownIcon className="size-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {REFRESH_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.scope} onClick={() => runRefresh(option.action)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
