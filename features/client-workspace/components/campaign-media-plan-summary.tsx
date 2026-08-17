import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  formatCompactCount,
  formatExactCount,
  NOT_AVAILABLE,
} from "../format";
import type { ClientMediaPlanSummary } from "../types";

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function CampaignMediaPlanSummary({
  summary,
  selectedCount,
  selectedInvestment,
}: {
  summary: ClientMediaPlanSummary;
  selectedCount: number;
  selectedInvestment?: number;
}) {
  const currency = summary.currency;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="Estimated reach"
          value={
            summary.estimatedReach != null
              ? formatCompactCount(summary.estimatedReach)
              : NOT_AVAILABLE
          }
        />
        <Metric
          label="Estimated engagements"
          value={
            summary.estimatedEngagements != null
              ? formatCompactCount(summary.estimatedEngagements)
              : NOT_AVAILABLE
          }
        />
        <Metric
          label="CPE"
          value={
            summary.cpe != null
              ? formatMoneyKpi(summary.cpe, currency)
              : NOT_AVAILABLE
          }
        />
        <Metric
          label="CPM"
          value={
            summary.cpm != null
              ? formatMoneyKpi(summary.cpm, currency)
              : NOT_AVAILABLE
          }
        />
        <Metric
          label="EMV"
          value={summary.emv != null ? formatMoneyKpi(summary.emv, currency) : NOT_AVAILABLE}
        />
        <Metric label="Creators" value={formatExactCount(summary.creatorCount)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
        <p>
          Accepted {selectedCount} · Investment{" "}
          {selectedInvestment != null
            ? formatMoneyKpi(selectedInvestment, currency)
            : NOT_AVAILABLE}
        </p>
        {summary.activityMix.length > 0 ? (
          <p className="text-zinc-500">
            {summary.activityMix
              .slice(0, 6)
              .map((item) => `${item.label} × ${item.count}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="text-zinc-400">Activity mix to be confirmed</p>
        )}
      </div>
    </section>
  );
}
