"use client";

import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { cn } from "@/lib/utils";

type Props = {
  health: CampaignMetricsSyncHealth;
  className?: string;
};

type SyncHealthTone =
  | "success"
  | "partial"
  | "danger"
  | "manual"
  | "queued"
  | "collecting";

const TONE_CLASS: Record<SyncHealthTone, string> = {
  success: "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]",
  partial: "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]",
  danger: "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]",
  manual: "bg-[var(--camp-purple-bg)] text-[var(--camp-purple-text)]",
  queued: "thinkway-campaign-badge-gray border border-[var(--camp-border)] bg-[var(--camp-surface)]",
  collecting: "bg-[var(--camp-blue-light)] text-[var(--camp-blue-text)]",
};

const DOT_CLASS: Record<SyncHealthTone, string> = {
  success: "bg-[var(--camp-green)]",
  partial: "bg-[var(--camp-amber)]",
  danger: "bg-[var(--camp-red)]",
  manual: "bg-[var(--camp-purple)]",
  queued: "bg-[var(--camp-text-3)]",
  collecting: "bg-[var(--camp-blue)]",
};

function SyncHealthPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: SyncHealthTone;
}) {
  return (
    <span className={cn("thinkway-campaign-sh-pill tabular-nums", TONE_CLASS[tone])}>
      <span className={cn("thinkway-campaign-sh-dot", DOT_CLASS[tone])} aria-hidden />
      {label} {count}
    </span>
  );
}

const SYNC_HEALTH_ITEMS: Array<{
  key: keyof Omit<CampaignMetricsSyncHealth, "total">;
  label: string;
  tone: SyncHealthTone;
}> = [
  { key: "synced", label: "Synced", tone: "success" },
  { key: "partial", label: "Partial", tone: "partial" },
  { key: "failed", label: "Failed", tone: "danger" },
  { key: "manual_required", label: "Manual required", tone: "manual" },
  { key: "queued", label: "Queued", tone: "queued" },
  { key: "collecting", label: "Collecting", tone: "collecting" },
];

export function CampaignPerformanceSyncHealth({ health, className }: Props) {
  return (
    <section
      className={cn("thinkway-campaign-sync-health", className)}
      aria-label="Metrics sync health"
    >
      <span className="thinkway-campaign-sh-title">Sync health</span>
      <span className="thinkway-campaign-sh-count">
        {health.total} publication{health.total === 1 ? "" : "s"}
      </span>
      <ul className="thinkway-campaign-sh-pills">
        {SYNC_HEALTH_ITEMS.map(({ key, label, tone }) => (
          <li key={key}>
            <SyncHealthPill label={label} count={health[key]} tone={tone} />
          </li>
        ))}
      </ul>
    </section>
  );
}
