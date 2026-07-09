"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addPlatformToCreatorAction } from "@/features/discovery/add-platform/actions";
import {
  pollCreatorAfterRefresh,
} from "@/features/discovery/enrichment/poll-creator-refresh";
import { syncStatusToEnrichmentStatus } from "@/features/discovery/enrichment/status";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { parseProfileInput } from "@/lib/social/parse-profile-url";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  unifiedId: string;
  influencerId?: string | null;
  discoveredProfileId?: string | null;
  existingPlatforms?: string[];
  onSuccess?: (creator: UnifiedCreatorResult, platformAccountId: string) => void;
  onEnrichmentStatusChange?: (
    unifiedId: string,
    status: ReturnType<typeof syncStatusToEnrichmentStatus>
  ) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function AddCreatorPlatformDialog({
  open,
  onOpenChange,
  creatorName,
  unifiedId,
  influencerId,
  discoveredProfileId,
  existingPlatforms = [],
  onSuccess,
  onEnrichmentStatusChange,
  onCreatorUpdated,
}: Props) {
  const [profileUrl, setProfileUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    const trimmed = profileUrl.trim();
    if (trimmed.length < 8) return null;
    return parseProfileInput(trimmed);
  }, [profileUrl]);

  const canConfirm = parsed != null && !isPending;

  const linkedSummary =
    existingPlatforms.length > 0
      ? existingPlatforms.map((p) => platformLabel(p)).join(", ")
      : null;

  useEffect(() => {
    if (!open) {
      setProfileUrl("");
      setError(null);
    }
  }, [open]);

  function handleConfirm() {
    const trimmed = profileUrl.trim();
    if (!parseProfileInput(trimmed)) {
      setError("Enter a valid Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile link.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await addPlatformToCreatorAction({
        profileUrl: trimmed,
        unifiedId,
        influencerId,
        discoveredProfileId,
      });

      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSuccess?.(result.creator, result.platformAccountId);
      onCreatorUpdated?.(result.creator);
      onOpenChange(false);

      const resolvedInfluencerId = result.creator.influencer_id;
      if (result.enrichmentQueued && resolvedInfluencerId) {
        const resolvedUnifiedId = result.creator.unified_id;
        onEnrichmentStatusChange?.(resolvedUnifiedId, "queued");
        void pollCreatorAfterRefresh(
          { unifiedId: resolvedUnifiedId, influencerId: resolvedInfluencerId },
          {
            onUpdated: (creator) => {
              onCreatorUpdated?.(creator);
            },
            onStatusChange: (syncStatus) => {
              onEnrichmentStatusChange?.(
                resolvedUnifiedId,
                syncStatusToEnrichmentStatus(syncStatus)
              );
            },
            onComplete: (syncStatus) => {
              if (syncStatus === "completed") {
                toast.success("Platform profile enriched");
              } else if (syncStatus === "failed") {
                toast.error("Enrichment failed", {
                  description: "Apify enrichment did not complete successfully.",
                });
              }
            },
          }
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-base font-bold tracking-tight">
            Add platform
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Link another social profile to {creatorName}. We&apos;ll enrich the account and
            update this creator automatically.
            {linkedSummary ? (
              <span className="mt-1 block text-xs">
                Already linked: {linkedSummary}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-6 py-5">
          <Input
            value={profileUrl}
            onChange={(event) => {
              setProfileUrl(event.target.value);
              if (error) setError(null);
            }}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://instagram.com/… or tiktok.com/@…"
            disabled={isPending}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm) {
                event.preventDefault();
                handleConfirm();
              }
            }}
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : isPending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Linking profile and queuing enrichment…
            </p>
          ) : parsed ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {parsed.platform.charAt(0).toUpperCase() + parsed.platform.slice(1)} profile
              detected (@{parsed.normalized_username})
            </p>
          ) : profileUrl.trim().length >= 8 ? (
            <p className="text-xs text-muted-foreground">
              Enter a supported social profile URL.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Add platform
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
