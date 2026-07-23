"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManualRefreshCacheAssessment } from "@/lib/creator-enrichment/manual-refresh-cache-assessment";
import type { ManualRefreshDataSource } from "@/lib/creator-enrichment/manual-refresh-policy";

import { formatLastUpdated } from "../status";

type ManualRefreshConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: ManualRefreshCacheAssessment | null;
  scopeLabel: string;
  isSubmitting?: boolean;
  onChoose: (dataSource: ManualRefreshDataSource) => void;
};

function formatSnapshotAge(lastLiveFetchAt: string | null): string {
  if (!lastLiveFetchAt) return "Unknown";
  return formatLastUpdated(lastLiveFetchAt);
}

export function ManualRefreshConfirmDialog({
  open,
  onOpenChange,
  assessment,
  scopeLabel,
  isSubmitting = false,
  onChoose,
}: ManualRefreshConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Fresh cached data available</DialogTitle>
          <DialogDescription>
            {scopeLabel} was updated recently. You can reuse the cached IPL snapshot for
            free, or fetch live data from Apify.
          </DialogDescription>
        </DialogHeader>

        {assessment ? (
          <dl className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Last enriched</dt>
              <dd className="font-medium">{formatLastUpdated(assessment.lastEnrichedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Last live fetch</dt>
              <dd className="font-medium">{formatLastUpdated(assessment.lastLiveFetchAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Snapshot age</dt>
              <dd className="font-medium">{formatSnapshotAge(assessment.lastLiveFetchAt)}</dd>
            </div>
          </dl>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onChoose("cached_snapshot")}
          >
            Use Cached Data
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onChoose("live_apify")}
          >
            Refresh Live (Uses Apify Credits)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
