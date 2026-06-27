"use client";

import type { CampaignPerformanceSummary } from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { cn } from "@/lib/utils";

type Props = {
  summary: CampaignPerformanceSummary;
};

type KpiCellProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "green" | "gray";
};

function KpiCell({ label, value, sub, tone }: KpiCellProps) {
  return (
    <div className="thinkway-campaign-kpi-cell">
      <div className="thinkway-campaign-kpi-lbl">{label}</div>
      <div
        className={cn(
          "thinkway-campaign-kpi-val tabular-nums",
          tone === "blue" && "thinkway-campaign-c-blue",
          tone === "green" && "thinkway-campaign-c-green",
          tone === "gray" && "thinkway-campaign-c-gray"
        )}
      >
        {value}
      </div>
      {sub ? <div className="thinkway-campaign-kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function CampaignPerformanceKpiStrip({ summary }: Props) {
  return (
    <div className="thinkway-campaign-kpi-strip">
      <KpiCell label="Publications" value={String(summary.total_publications)} />
      <KpiCell
        label="Total reach"
        value={formatCompactCount(summary.total_reach)}
        sub={`Actual ${formatCompactCount(summary.total_actual_reach)}`}
        tone="blue"
      />
      <KpiCell
        label="Impressions"
        value={formatCompactCount(summary.total_impressions)}
        sub={`Actual ${formatCompactCount(summary.total_actual_impressions)}`}
      />
      <KpiCell label="Total views" value={formatCompactCount(summary.total_views)} />
      <KpiCell label="Engagements" value={formatCompactCount(summary.total_engagements)} />
      <KpiCell
        label="Avg ER %"
        value={formatPercent(summary.average_engagement_rate)}
        tone="green"
      />
      <KpiCell
        label="CPM"
        value={formatMoneyValue(summary.average_cpm, summary.currency)}
        tone="gray"
      />
      <KpiCell
        label="CPV"
        value={formatMoneyValue(summary.average_cpv, summary.currency)}
        tone="gray"
      />
    </div>
  );
}
