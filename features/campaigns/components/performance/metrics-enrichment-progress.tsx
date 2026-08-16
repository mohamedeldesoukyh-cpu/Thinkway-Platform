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
import { Progress } from "@/components/ui/progress";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { countMetricsEnrichmentSettled } from "@/lib/performance/metrics-enrichment-batch";
import { cn } from "@/lib/utils";

const SUMMARY_ITEMS: Array<{
  key: keyof Omit<CampaignMetricsSyncHealth, "total">;
  label: string;
  toneClass: string;
}> = [
  {
    key: "synced",
    label: "Synced",
    toneClass: "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]",
  },
  {
    key: "partial",
    label: "Partial",
    toneClass: "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]",
  },
  {
    key: "failed",
    label: "Failed",
    toneClass: "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]",
  },
  {
    key: "manual_required",
    label: "Manual required",
    toneClass: "bg-[var(--camp-purple-bg)] text-[var(--camp-purple-text)]",
  },
  {
    key: "queued",
    label: "Queued",
    toneClass:
      "border border-[var(--camp-border)] bg-[var(--camp-surface)] text-[var(--camp-text-2)]",
  },
  {
    key: "collecting",
    label: "Collecting",
    toneClass: "bg-[var(--camp-blue-light)] text-[var(--camp-blue-text)]",
  },
];

type ProgressProps = {
  active: boolean;
  health: CampaignMetricsSyncHealth;
  progressPercent: number;
  creatorCount: number;
  className?: string;
};

export function MetricsEnrichmentProgressBanner({
  active,
  health,
  progressPercent,
  creatorCount,
  className,
}: ProgressProps) {
  if (!active || health.total <= 0) return null;
  const settled = countMetricsEnrichmentSettled(health);

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--camp-border)] bg-[var(--camp-surface)] px-3 py-2.5",
        className
      )}
      aria-label="Metrics enrichment progress"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--camp-text-1)]">
          Enriching metrics…
        </p>
        <p className="text-[11px] tabular-nums text-[var(--camp-text-3)]">
          {settled}/{health.total} publications · {creatorCount} creator
          {creatorCount === 1 ? "" : "s"}
        </p>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {SUMMARY_ITEMS.map(({ key, label, toneClass }) => (
          <li key={key}>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
                toneClass
              )}
            >
              {label} {health[key]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type SummaryProps = {
  open: boolean;
  health: CampaignMetricsSyncHealth | null;
  creatorCount: number;
  onOpenChange: (open: boolean) => void;
};

export function MetricsEnrichmentSummaryDialog({
  open,
  health,
  creatorCount,
  onOpenChange,
}: SummaryProps) {
  if (!health) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Metrics enrichment complete</DialogTitle>
          <DialogDescription>
            Finished {health.total} publication{health.total === 1 ? "" : "s"} across{" "}
            {creatorCount} creator{creatorCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-2">
          {SUMMARY_ITEMS.map(({ key, label, toneClass }) => (
            <li
              key={key}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-[12px]",
                toneClass
              )}
            >
              <span>{label}</span>
              <span className="font-semibold tabular-nums">{health[key]}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
