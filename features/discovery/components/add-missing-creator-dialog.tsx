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
import { Textarea } from "@/components/ui/textarea";
import { addCreatorsByProfileUrlsAction } from "@/features/discovery/add-creator-by-url/actions";
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_DESC_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_TEXTAREA_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import {
  pollCreatorAfterRefresh,
} from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  syncStatusToEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import { MAX_ADD_MISSING_CREATORS } from "@/lib/discovery/add-creator-constants";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";
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

function summarizeAddOutcome(input: {
  added: number;
  skipped: number;
  failed: number;
  invalid: number;
}): string {
  const parts: string[] = [];
  if (input.added > 0) {
    parts.push(`Added ${input.added} creator${input.added === 1 ? "" : "s"}`);
  }
  if (input.skipped > 0) {
    parts.push(
      `skipped ${input.skipped} already in Discovery`
    );
  }
  if (input.failed > 0) {
    parts.push(`${input.failed} failed`);
  }
  if (input.invalid > 0) {
    parts.push(`${input.invalid} invalid link${input.invalid === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) {
    return "No creators were added.";
  }
  return `${parts[0]}${parts.length > 1 ? `. ${parts.slice(1).join("; ")}.` : "."}`;
}

export function AddMissingCreatorDialog({
  open,
  onOpenChange,
  onSuccess,
  onEnrichmentStatusChange,
  onCreatorUpdated,
}: Props) {
  const [profileUrls, setProfileUrls] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => parseProfileInputList(profileUrls), [profileUrls]);
  const canConfirm = preview.parsed.length > 0 && !isPending;

  useEffect(() => {
    if (!open) {
      setProfileUrls("");
      setError(null);
    }
  }, [open]);

  function handleConfirm() {
    const trimmed = profileUrls.trim();
    const parsed = parseProfileInputList(trimmed);
    if (parsed.parsed.length === 0) {
      setError(
        "Paste Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile links (one per line)."
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await addCreatorsByProfileUrlsAction(trimmed);
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }

      const summary = summarizeAddOutcome({
        added: result.added.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
        invalid: result.invalid.length,
      });

      if (result.added.length > 0) {
        toast.success(summary);
      } else if (result.skipped.length > 0 && result.failed.length === 0) {
        toast.info(summary);
      } else {
        toast.error(summary);
        if (result.failed[0]) {
          setError(result.failed[0].message);
        }
        return;
      }

      for (const [index, creator] of result.added.entries()) {
        onSuccess?.(creator);
        const influencerId = creator.influencer_id;
        if (!influencerId || index >= 8) continue;
        const unifiedId = creator.unified_id;
        onEnrichmentStatusChange?.(unifiedId, "queued");
        void pollCreatorAfterRefresh(
          { unifiedId, influencerId },
          {
            onUpdated: (updated) => {
              onCreatorUpdated?.(updated);
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

      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("discovery-suite", DISCOVERY_DIALOG_CONTENT_CLASS)}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Add missing creator
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Paste one or more profile links. Usernames are taken from the URL.
              Creators already in Discovery are skipped.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={cn("space-y-2", DISCOVERY_DIALOG_BODY_CLASS)}>
          <Textarea
            value={profileUrls}
            onChange={(event) => {
              setProfileUrls(event.target.value);
              if (error) setError(null);
            }}
            rows={6}
            autoComplete="off"
            placeholder={`https://www.instagram.com/username\nhttps://www.tiktok.com/@username`}
            className={cn(DISCOVERY_DIALOG_TEXTAREA_CLASS, "min-h-[132px]")}
            disabled={isPending}
            autoFocus
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : isPending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Adding creators…
            </p>
          ) : preview.parsed.length > 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {preview.parsed.length} profile
              {preview.parsed.length === 1 ? "" : "s"} detected
              {preview.parsed.length > MAX_ADD_MISSING_CREATORS
                ? ` (first ${MAX_ADD_MISSING_CREATORS} will be added)`
                : ""}
              {preview.invalid.length > 0
                ? ` · ${preview.invalid.length} unrecognized`
                : ""}
            </p>
          ) : profileUrls.trim().length >= 8 ? (
            <p className="text-xs text-muted-foreground">
              Enter supported social profile URLs, one per line.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Up to {MAX_ADD_MISSING_CREATORS} links per batch.
            </p>
          )}
        </div>

        <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
          <span className="tw-cs mr-auto max-w-[18rem] text-left text-[11px] leading-snug text-muted-foreground">
            New creators enter Discovery unenriched — metrics follow on the next sync.
          </span>
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
            {preview.parsed.length > 1 ? "Add creators" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EmptyStateProps = {
  visible: boolean;
  className?: string;
  onOpen?: () => void;
  onSuccess?: (creator: UnifiedCreatorResult) => void;
  onEnrichmentStatusChange?: Props["onEnrichmentStatusChange"];
  onCreatorUpdated?: Props["onCreatorUpdated"];
};

export function AddMissingCreatorEmptyState({
  visible,
  className,
  onOpen,
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
          onClick={() => (onOpen ? onOpen() : setOpen(true))}
          className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          Add missing creator
        </button>
      </div>
      {onOpen ? null : (
        <AddMissingCreatorDialog
          open={open}
          onOpenChange={setOpen}
          onSuccess={onSuccess}
          onEnrichmentStatusChange={onEnrichmentStatusChange}
          onCreatorUpdated={onCreatorUpdated}
        />
      )}
    </>
  );
}
