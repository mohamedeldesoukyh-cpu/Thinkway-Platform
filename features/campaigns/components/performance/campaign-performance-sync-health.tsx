"use client";

import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { cn } from "@/lib/utils";

type Props = {
  health: CampaignMetricsSyncHealth;
  className?: string;
};

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
}) {
  const toneClass = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    danger:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
    neutral: "border-border bg-muted text-muted-foreground",
    info: "border-primary/20 bg-primary/10 text-primary",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-3 py-2", toneClass)}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function CampaignPerformanceSyncHealth({ health, className }: Props) {
  return (
    <section className={cn("space-y-2 rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Sync health</p>
          <p className="text-[11px] text-muted-foreground">
            Metrics collection status across {health.total} publication
            {health.total === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Synced" value={health.synced} tone="success" />
        <Kpi label="Partial" value={health.partial} tone="warning" />
        <Kpi label="Failed" value={health.failed} tone="danger" />
        <Kpi label="Manual required" value={health.manual_required} tone="warning" />
        <Kpi label="Queued" value={health.queued} tone="info" />
        <Kpi label="Collecting" value={health.collecting} tone="info" />
      </div>
    </section>
  );
}
