
import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPlatformDialogSession, queuePlatformAddition, splitPlatformLinks } from "@/features/discovery/enrichment/platform-add-queue";
import { toast } from "sonner";
import { PlatformOwnerConflict } from "./platform-owner-conflict";

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
import { addPlatformToCreatorAction } from "@/features/discovery/add-platform/actions";
import { getCreatorRefreshPollStatusAction } from "@/features/discovery/enrichment/actions";
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
import { syncStatusToEnrichmentStatus } from "@/features/discovery/enrichment/status";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { cn } from "@/lib/utils";

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<UnifiedCreatorResult | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const isPending = pendingCount > 0;
  const dialogSession = useRef(createPlatformDialogSession());

  const parsed = useMemo(() => {
    const links = splitPlatformLinks(profileUrl);
    if (!links.length || links.some(link => !parseProfileInput(link))) return null;
    return links;
  }, [profileUrl]);

  const canConfirm = parsed != null && !isPending && !mergeBusy && !conflict;

  const linkedSummary =
    existingPlatforms.length > 0
      ? existingPlatforms.map((p) => platformLabel(p)).join(", ")
      : null;

  useEffect(() => {
    const session = dialogSession.current;
    if (open) session.open();
    else session.close();
    if (!open) {
      setProfileUrl("");
      setError(null); setConflict(null);
      setPendingCount(0);
    }
    return () => { session.close(); };
  }, [open]);

  function handleOpenChange(next: boolean) {
    // Always allow dismiss — enrichment continues in the background after link.
    if (!next) dialogSession.current.close();
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!canConfirm) return;
    const links = splitPlatformLinks(profileUrl);
    if (!links.length || links.some(link => !parseProfileInput(link))) {
      setError("Enter a valid Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile link.");
      return;
    }

    setError(null); setConflict(null);
    setProfileUrl("");
    setPendingCount(count => count + links.length);
    const canUpdateDialog = dialogSession.current.capture();
    for (const trimmed of links) void queuePlatformAddition(influencerId ?? unifiedId, async () => {
      try {
        // Admission is creator-wide: wait for existing work before linking the next
        // profile, otherwise the backend would treat it as an already-running job.
        if (influencerId) {
          let status = await getCreatorRefreshPollStatusAction(influencerId);
          while (status.syncStatus === "queued" || status.syncStatus === "collecting") {
            await pollCreatorAfterRefresh({ unifiedId, influencerId }, {
              onUpdated: creator => onCreatorUpdated?.(creator),
            });
            status = await getCreatorRefreshPollStatusAction(influencerId);
          }
        }
        const result = await addPlatformToCreatorAction({
          profileUrl: trimmed,
          unifiedId,
          influencerId,
          discoveredProfileId,
        });

        if (!result.ok) {
          if (canUpdateDialog()) {
            setError(result.message); setConflict(result.conflictingCreator ?? null);
          }
          toast.error(`${creatorName}: ${result.message}`, { description: trimmed });
          return;
        }

        // Linking is saved and queue admission has returned. Close before polling;
        // the creator-scoped queue continues even if this dialog unmounts.
        if (canUpdateDialog()) handleOpenChange(false);
        toast.success(`${creatorName}: ${result.message}`);
        if (onSuccess) onSuccess(result.creator, result.platformAccountId);
        else onCreatorUpdated?.(result.creator);

        const resolvedInfluencerId = result.creator.influencer_id;
        if (result.enrichmentQueued && resolvedInfluencerId) {
          const resolvedUnifiedId = result.creator.unified_id;
          onEnrichmentStatusChange?.(resolvedUnifiedId, "queued");
          await pollCreatorAfterRefresh(
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
                  toast.success(`${creatorName}: Platform profile enriched`);
                } else if (syncStatus === "failed") {
                  toast.error(`${creatorName}: Enrichment failed`, {
                    description: "Apify enrichment did not complete successfully.",
                  });
                }
              },
            }
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not link platform. Please try again.";
        if (canUpdateDialog()) setError(message);
        toast.error(`${creatorName}: ${message}`, { description: trimmed });
      } finally {
        if (canUpdateDialog()) setPendingCount(count => Math.max(0, count - 1));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!mergeBusy) handleOpenChange(next); }}>
      <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "max-h-[90dvh] sm:max-w-2xl")}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Add platform
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Link another social profile to {creatorName}. This dialog closes after linking;
              enrichment continues in the background while you work on other creators.
              {linkedSummary ? (
                <span className="mt-1 block text-xs">
                  Already linked: {linkedSummary}
                </span>
              ) : null}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={cn("space-y-2", DISCOVERY_DIALOG_BODY_CLASS)}>
          <Textarea
            ref={inputRef}
            value={profileUrl}
            onChange={(event) => {
              setProfileUrl(event.target.value);
              if (error) setError(null); setConflict(null);
            }}
            inputMode="url"
            autoComplete="off"
            placeholder="Paste profile links, separated by spaces or new lines"
            className={DISCOVERY_DIALOG_INPUT_CLASS}
            disabled={mergeBusy}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canConfirm) {
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
              Adding {pendingCount} platform(s). You can close this dialog; queued work will continue.
            </p>
          ) : parsed ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {parsed.length} valid profile link(s) ready to add
            </p>
          ) : profileUrl.trim().length >= 8 ? (
            <p className="text-xs text-muted-foreground">
              Enter a supported social profile URL.
            </p>
          ) : null}
        {conflict && <PlatformOwnerConflict owner={conflict} currentUnifiedId={influencerId ? `inf:${influencerId}` : unifiedId} onIgnore={() => { setConflict(null); setError(null); setProfileUrl(""); inputRef.current?.focus(); }} onBusyChange={setMergeBusy} onMerged={next => { onCreatorUpdated?.(next); onOpenChange(false); }} />}
        </div>
        <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            disabled={mergeBusy} onClick={() => handleOpenChange(false)}
          >
            {isPending ? "Close" : "Cancel"}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Add to queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
