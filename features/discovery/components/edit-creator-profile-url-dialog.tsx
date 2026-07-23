"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { platformLabel } from "@/features/campaigns/line-assignment";
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
import { updatePlatformProfileUrlAction } from "@/features/discovery/edit-platform-url/actions";
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
import type { UnifiedCreatorPlatform, UnifiedCreatorResult } from "@/lib/creators/types";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult;
  platform: UnifiedCreatorPlatform | null;
  onSaved?: (creator: UnifiedCreatorResult) => void;
  onEnrichmentStatusChange?: (
    unifiedId: string,
    status: ReturnType<typeof syncStatusToEnrichmentStatus>
  ) => void;
};

export function EditCreatorProfileUrlDialog({
  open,
  onOpenChange,
  creator,
  platform,
  onSaved,
  onEnrichmentStatusChange,
}: Props) {
  const [profileUrl, setProfileUrl] = useState(platform?.profile_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    const trimmed = profileUrl.trim();
    if (trimmed.length < 8) return null;
    return parseProfileInput(trimmed);
  }, [profileUrl]);

  const influencerId = creator.influencer_id;
  const platformAccountId = platform?.id ?? null;
  const currentUrl = platform?.profile_url?.trim() ?? "";
  const urlChanged = profileUrl.trim() !== currentUrl;
  const canConfirm =
    parsed != null && urlChanged && Boolean(influencerId && platformAccountId) && !isPending;

  useEffect(() => {
    if (!open) return;
    setProfileUrl(platform?.profile_url ?? "");
    setError(null);
  }, [open, platform?.id, platform?.profile_url]);

  function handleSave() {
    const trimmed = profileUrl.trim();
    if (!parseProfileInput(trimmed)) {
      setError("Enter a valid Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile link.");
      return;
    }

    if (!influencerId || !platformAccountId) {
      setError("This creator cannot update profile URLs yet.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updatePlatformProfileUrlAction({
        profileUrl: trimmed,
        unifiedId: creator.unified_id,
        influencerId,
        platformAccountId,
      });

      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSaved?.(result.creator);
      onOpenChange(false);

      if (result.enrichmentQueued) {
        const resolvedUnifiedId = result.creator.unified_id;
        onEnrichmentStatusChange?.(resolvedUnifiedId, "queued");
        void pollCreatorAfterRefresh(
          { unifiedId: resolvedUnifiedId, influencerId },
          {
            onUpdated: (nextCreator) => {
              onSaved?.(nextCreator);
            },
            onStatusChange: (syncStatus) => {
              onEnrichmentStatusChange?.(
                resolvedUnifiedId,
                syncStatusToEnrichmentStatus(syncStatus)
              );
            },
            onComplete: (syncStatus) => {
              if (syncStatus === "completed") {
                toast.success("Profile enriched");
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

  const platformName = platform ? platformLabel(platform.platform) : "platform";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DISCOVERY_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Edit profile URL
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Replace the {platformName} profile link for {creator.display_name}. The new URL must
              stay on {platformName}.
              {platform?.handle ? (
                <span className="mt-1 block text-xs">
                  Current: @{platform.handle.replace(/^@/, "")}
                </span>
              ) : null}
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
            placeholder="https://instagram.com/… or tiktok.com/@…"
            className={DISCOVERY_DIALOG_INPUT_CLASS}
            disabled={isPending || !influencerId || !platformAccountId}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm) {
                event.preventDefault();
                handleSave();
              }
            }}
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : isPending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Updating profile URL…
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
          {!influencerId || !platformAccountId ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Link this creator to a vendor profile before editing profile URLs.
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
          <Button type="button" onClick={handleSave} disabled={!canConfirm}>
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
