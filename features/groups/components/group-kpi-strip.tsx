"use client";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

export function GroupKpiStrip({ workspace }: { workspace: GroupWorkspace }) {
  const { counts, financials } = workspace;
  return <div className="wr-metrics" aria-label="Group metrics">
    <section className="wr-metrics-zone wr-metrics-private">
      <div className="wr-metrics-band">Internal — never shown to the client</div>
      <div className="wr-metrics-cells">
        <div><i>Total revenue</i><b>{formatGroupMoney(financials.total_revenue)}</b></div>
        <div><i>Total GP</i><b>{formatGroupMoney(financials.total_gp)}</b></div>
        <div><i>Margin</i><b>{formatPercent(financials.margin_percent)}</b></div>
      </div>
    </section>
    <section className="wr-metrics-zone">
      <div className="wr-metrics-band">Portfolio</div>
      <div className="wr-metrics-cells">
        <div><i>Legal entities</i><b>{String(counts.legal_entities)}</b></div>
        <div><i>Brands</i><b>{String(counts.brands)}</b></div>
        <div><i>Campaigns</i><b>{String(counts.campaigns)}</b></div>
      </div>
    </section>
  </div>;
}
