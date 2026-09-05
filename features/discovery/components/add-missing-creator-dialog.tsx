"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addCreatorsByProfileUrlsAction } from "@/features/discovery/add-creator-by-url/actions";
import { DISCOVERY_DIALOG_CONTENT_CLASS } from "@/features/discovery/components/design-system";
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
      <DialogContent
        className={cn(
          "discovery-suite tw-dlg__w gap-0 border-0 p-0 sm:max-w-[520px]",
          DISCOVERY_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader className="tw-dlg__h relative space-y-0 text-left">
          <DialogTitle className="sr-only">Add missing creator</DialogTitle>
          <i>Discovery</i>
          <b>Add missing creator</b>
          <DialogDescription asChild>
            <p>
              Paste one or more profile links. Usernames are taken from the URL,
              and creators already in Discovery are skipped rather than duplicated.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="tw-dlg__b">
          <textarea
            value={profileUrls}
            onChange={(event) => {
              setProfileUrls(event.target.value);
              if (error) setError(null);
            }}
            className="tw-in tw-paste"
            spellCheck={false}
            aria-label="Profile links"
            placeholder={"https://www.instagram.com/username\nhttps://www.tiktok.com/@username"}
            disabled={isPending}
            autoFocus
          />
          <div className="tw-slmeta" style={{ margin: "12px 0 0" }}>
            <div>
              <i>Detected</i>
              <b>{preview.parsed.length}</b>
            </div>
            <div>
              <i>New</i>
              <b>{preview.parsed.length}</b>
            </div>
            <div>
              <i>Already in Discovery</i>
              <b>0</b>
            </div>
          </div>
          {error ? (
            <p className="tw-hint" style={{ color: "var(--tw-bad)" }}>
              {error}
            </p>
          ) : (
            <div className="tw-hint">
              Up to <b>{MAX_ADD_MISSING_CREATORS} links per batch</b>. Instagram,
              TikTok, YouTube and X are recognised.
              {isPending ? " Adding creators…" : ""}
            </div>
          )}
        </div>

        <div className="tw-dlg__f">
          <span className="tw-cs">
            New creators enter Discovery unenriched — metrics follow on the next
            sync.
          </span>
          <span className="tw-sp" />
          <button
            type="button"
            className="tw-b sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tw-b sm pri"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isPending ? "Adding…" : "Confirm"}
          </button>
        </div>
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
