import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatCompactCount, formatExactCount, NOT_AVAILABLE } from "../format";
import type { ClientMediaPlanSummary } from "../types";
import { MetricCard } from "./media-plan-ui";

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
        <MetricCard
          label="Estimated reach"
          value={summary.estimatedReach != null ? formatCompactCount(summary.estimatedReach) : NOT_AVAILABLE}
        />
        <MetricCard
          label="Estimated engagements"
          value={
            summary.estimatedEngagements != null
              ? formatCompactCount(summary.estimatedEngagements)
              : NOT_AVAILABLE
          }
        />
        <MetricCard
          label="CPE"
          value={summary.cpe != null ? formatMoneyKpi(summary.cpe, currency) : NOT_AVAILABLE}
        />
        <MetricCard
          label="CPM"
          value={summary.cpm != null ? formatMoneyKpi(summary.cpm, currency) : NOT_AVAILABLE}
        />
        {summary.emv != null ? (
          <MetricCard label="EMV" value={formatMoneyKpi(summary.emv, currency)} />
        ) : (
          <MetricCard label="EMV" value={NOT_AVAILABLE} />
        )}
        <MetricCard label="Creators" value={formatExactCount(summary.creatorCount)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
        <p>
          Accepted {selectedCount} · Investment{" "}
          {selectedInvestment != null ? formatMoneyKpi(selectedInvestment, currency) : NOT_AVAILABLE}
        </p>
        {summary.activityMix.length > 0 ? (
          <p className="text-zinc-500">
            {summary.activityMix
              .slice(0, 6)
              .map((item) => `${item.count} ${item.label}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="text-zinc-400">Activity mix to be confirmed</p>
        )}
      </div>
    </section>
  );
}
