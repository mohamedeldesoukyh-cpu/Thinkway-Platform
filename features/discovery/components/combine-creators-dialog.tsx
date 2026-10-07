"use client";

import { GitMergeIcon, Loader2Icon } from "lucide-react";
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
import { CreatorPickerDialog } from "@/features/creators/picker/creator-picker-dialog";
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_DESC_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import {
  getMergeCreatorsEligibilityAction,
  mergeCreatorsAction,
} from "@/features/discovery/merge-creators/actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { evaluateMergeCreatorsEligibility } from "@/lib/discovery/merge-creators";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { MergeRateConflictResolver } from "@/features/discovery/merge-creators/rate-conflict-resolver";
import { cn } from "@/lib/utils";

export type CombineCreatorsMergedMeta = {
  removedUnifiedId: string;
  removedInfluencerId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCreator: UnifiedCreatorResult;
  initialSourceCreator?: UnifiedCreatorResult | null;
  onSwapCreators?: () => void;
  onMerged?: (creator: UnifiedCreatorResult, meta: CombineCreatorsMergedMeta) => void;
};

function platformSummary(creator: UnifiedCreatorResult): string {
  if (creator.platforms.length === 0) return "No platforms linked";
  return creator.platforms.map((platform) => platformLabel(platform.platform)).join(", ");
}

export function CombineCreatorsDialog({
  open,
  onOpenChange,
  targetCreator,
  initialSourceCreator,
  onSwapCreators,
  onMerged,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceCreator, setSourceCreator] = useState<UnifiedCreatorResult | null>(initialSourceCreator ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverCanMerge, setServerCanMerge] = useState(false);
  const [checkRevision, setCheckRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const targetInfluencerId = targetCreator.influencer_id;

  const localEligibility = useMemo(() => {
    if (!sourceCreator) return null;
    return evaluateMergeCreatorsEligibility({
      targetPlatforms: targetCreator.platforms,
      sourcePlatforms: sourceCreator.platforms,
    });
  }, [sourceCreator, targetCreator.platforms]);

  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      setSourceCreator(null);
      setServerMessage(null);
      setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !sourceCreator?.influencer_id || !targetInfluencerId) {
      setServerMessage(null);
      return;
    }

    let active = true;
    setServerCanMerge(false);
    setServerMessage(null);
    void getMergeCreatorsEligibilityAction({
      targetInfluencerId,
      sourceInfluencerId: sourceCreator.influencer_id,
    }).then((result) => {
      if (!active) return;
      setServerMessage(result.message);
      setServerCanMerge(result.canMerge);
    }).catch(() => {
      if (!active) return;
      setServerCanMerge(false);
      setServerMessage("Could not check linked records. Use Recheck linked records to retry.");
    });

    return () => {
      active = false;
    };
  }, [open, sourceCreator?.influencer_id, targetInfluencerId, checkRevision]);

  const canConfirm =
    Boolean(
      targetInfluencerId &&
        sourceCreator?.influencer_id &&
        localEligibility?.canMerge &&
        serverCanMerge &&
        !isPending
    );

  function handleConfirm() {
    if (!targetInfluencerId || !sourceCreator?.influencer_id) {
      setError("Both creators must be linked to vendor profiles.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await mergeCreatorsAction({
          targetInfluencerId,
          sourceInfluencerId: sourceCreator.influencer_id!,
          targetUnifiedId: targetCreator.unified_id,
        });

        if (!result.ok) {
          setError(result.message);
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
        onMerged?.(result.creator, {
          removedUnifiedId: sourceCreator.unified_id,
          removedInfluencerId: sourceCreator.influencer_id,
        });
        onOpenChange(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not combine creators. Please try again.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "sm:max-w-3xl max-h-[90dvh] overflow-y-auto")}>
          <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
            <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
                Discovery
              </p>
              <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
                Combine creators
              </DialogTitle>
              <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
                Merge a duplicate creator profile into {targetCreator.display_name}. Platform
                accounts from the other profile will move here, then the duplicate profile is
                removed. Shortlists, quotations, campaigns, rate cards, documents and history
                transfer to the surviving profile. Separate jobs keep their prices and documents.
                This cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className={cn(DISCOVERY_DIALOG_BODY_CLASS, "space-y-4")}>
            <div className="rounded-xl border border-border bg-muted/10 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Keep
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{targetCreator.display_name}</p>
              {onSwapCreators && <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onSwapCreators}>Keep the other creator instead</Button>}
              <p className="mt-1 text-xs text-muted-foreground">{platformSummary(targetCreator)}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/10 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Combine in
                  </p>
                  {sourceCreator ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {sourceCreator.display_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {platformSummary(sourceCreator)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the duplicate creator profile to merge.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!targetInfluencerId || isPending}
                  onClick={() => setPickerOpen(true)}
                >
                  {sourceCreator ? "Change" : "Select creator"}
                </Button>
              </div>
            </div>

            {sourceCreator && localEligibility ? (
              <div
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-xs",
                  localEligibility.canMerge && serverCanMerge
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                )}
              >
                <p>{serverMessage ?? localEligibility.message}</p>
                {localEligibility.platformsToMove.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {localEligibility.platformsToMove.map((platform) => (
                      <span
                        key={platform}
                        className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium dark:bg-black/20"
                      >
                        <PlatformIcon platform={platform} size="xs" className="size-3" />
                        {platformLabel(platform)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {serverMessage?.includes("Both creators have prices in the same rate card") && targetInfluencerId && sourceCreator?.influencer_id ? (
              <MergeRateConflictResolver key={`${targetInfluencerId}:${sourceCreator.influencer_id}`} targetId={targetInfluencerId} sourceId={sourceCreator.influencer_id} targetName={targetCreator.display_name} sourceName={sourceCreator.display_name} onResolved={() => setCheckRevision(value => value + 1)} />
            ) : null}
            {sourceCreator && <Button variant="outline" size="sm" disabled={isPending} onClick={() => setCheckRevision(value => value + 1)}>Recheck linked records</Button>}
            {!targetInfluencerId ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Promote or link this creator to a vendor profile before combining profiles.
              </p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <GitMergeIcon aria-hidden />}
              Combine creators
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreatorPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Select duplicate creator"
        description="Pick the other profile for the same person. Their platform accounts will move to the creator you opened."
        selectionMode="single"
        panelLayout
        confirmLabel="Use this creator"
        productionOnly={false}
        pageSize={16}
        browseFilters={{
          skipCoverageBackfill: true,
          // Vendor-linked profiles only (internal / imported / oauth).
          source: "internal",
        }}
        showAddMissingCreator={false}
        isRowDisabled={(creator) =>
          creator.unified_id === targetCreator.unified_id ||
          !creator.influencer_id
        }
        onConfirm={(creators) => {
          const next = creators[0] ?? null;
          setSourceCreator(next);
          setError(null);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
