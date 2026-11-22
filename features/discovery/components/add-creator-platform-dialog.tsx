
import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { queuePlatformAddition, splitPlatformLinks } from "@/features/discovery/enrichment/platform-add-queue";
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
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<UnifiedCreatorResult | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const isPending = pendingCount > 0;
  const openRef = useRef(open);

  const parsed = useMemo(() => {
    const links = splitPlatformLinks(profileUrl);
    if (!links.length || links.some(link => !parseProfileInput(link))) return null;
    return links;
  }, [profileUrl]);

  const canConfirm = parsed != null && !mergeBusy && !conflict;

  const linkedSummary =
    existingPlatforms.length > 0
      ? existingPlatforms.map((p) => platformLabel(p)).join(", ")
      : null;

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      setProfileUrl("");
      setError(null); setConflict(null);
    }
    return () => { openRef.current = false; };
  }, [open]);

  function handleOpenChange(next: boolean) {
    // Always allow dismiss — enrichment continues in the background after link.
    openRef.current = next;
    onOpenChange(next);
  }

  function handleConfirm() {
    const links = splitPlatformLinks(profileUrl);
    if (!links.length || links.some(link => !parseProfileInput(link))) {
      setError("Enter a valid Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile link.");
      return;
    }

    setError(null); setConflict(null);
    setProfileUrl("");
    setPendingCount(count => count + links.length);
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
          if (openRef.current) {
            setError(result.message); setConflict(result.conflictingCreator ?? null);
          }
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
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
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not link platform. Please try again.";
        if (openRef.current) setError(message);
        toast.error(message);
      } finally {
        setPendingCount(count => Math.max(0, count - 1));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!mergeBusy) handleOpenChange(next); }}>
      <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "max-h-[90dvh] overflow-y-auto")}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Add platform
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Link another social profile to {creatorName}. Enrichment runs in the background —
              you can close this and keep working.
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
              {pendingCount} platform(s) queued or enriching. You can add more or close this dialog.
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
        </div>

        {conflict && <div className="px-6"><PlatformOwnerConflict owner={conflict} currentUnifiedId={influencerId ? `inf:${influencerId}` : unifiedId} onBusyChange={setMergeBusy} onMerged={next => { onCreatorUpdated?.(next); onOpenChange(false); }} /></div>}
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
