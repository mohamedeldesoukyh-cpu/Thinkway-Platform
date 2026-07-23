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
import { addCreatorByProfileUrlAction } from "@/features/discovery/add-creator-by-url/actions";
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_DESC_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_INPUT_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import {
  pollCreatorAfterRefresh,
} from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  syncStatusToEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (creator: UnifiedCreatorResult) => void;
  onEnrichmentStatusChange?: (
    unifiedId: string,
    status: ReturnType<typeof syncStatusToEnrichmentStatus>
  ) => void;
  onCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function AddMissingCreatorDialog({
  open,
  onOpenChange,
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
      const result = await addCreatorByProfileUrlAction(trimmed);
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSuccess?.(result.creator);
      onOpenChange(false);

      const influencerId = result.creator.influencer_id;
      if (result.enrichmentQueued && influencerId) {
        const unifiedId = result.creator.unified_id;
        onEnrichmentStatusChange?.(unifiedId, "queued");
        void pollCreatorAfterRefresh(
          { unifiedId, influencerId },
          {
            onUpdated: (creator) => {
              onCreatorUpdated?.(creator);
            },
            onStatusChange: (syncStatus) => {
              onEnrichmentStatusChange?.(
                unifiedId,
                syncStatusToEnrichmentStatus(syncStatus)
              );
            },
            onComplete: (syncStatus) => {
              if (syncStatus === "completed") {
                toast.success("Creator profile updated");
              } else if (syncStatus === "failed") {
                toast.warning("Full Apify enrichment unavailable", {
                  description:
                    "The creator was saved with preview data. Use Refresh metrics to try again later.",
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
      <DialogContent className={DISCOVERY_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Add creator
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Paste the link to the creator profile you want to add
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={cn("space-y-2", DISCOVERY_DIALOG_BODY_CLASS)}>
          <Input
            value={profileUrl}
            onChange={(event) => {
              setProfileUrl(event.target.value);
              if (error) setError(null);
            }}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="Creator's profile link"
            className={DISCOVERY_DIALOG_INPUT_CLASS}
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
              Adding creator and queuing enrichment…
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

        <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
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
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EmptyStateProps = {
  visible: boolean;
  className?: string;
  onSuccess?: (creator: UnifiedCreatorResult) => void;
  onEnrichmentStatusChange?: Props["onEnrichmentStatusChange"];
  onCreatorUpdated?: Props["onCreatorUpdated"];
};

export function AddMissingCreatorEmptyState({
  visible,
  className,
  onSuccess,
  onEnrichmentStatusChange,
  onCreatorUpdated,
}: EmptyStateProps) {
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 text-center",
          className
        )}
      >
        <p className="text-xs text-muted-foreground">
          Can&apos;t find the creator you&apos;re looking for?
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          Add missing creator
        </button>
      </div>
      <AddMissingCreatorDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
        onEnrichmentStatusChange={onEnrichmentStatusChange}
        onCreatorUpdated={onCreatorUpdated}
      />
    </>
  );
}
