"use client";

import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignKpiStripProps = {
  workspace: CampaignWorkspace;
  operationalDeliverableCount?: number;
};

type MetricDef = {
  id: string;
  label: string;
  value: string;
  tone?: "amber" | "blue" | "green" | "red" | "gray";
};

const TONE_CLASS = {
  amber: "thinkway-campaign-c-amber",
  blue: "thinkway-campaign-c-blue",
  green: "thinkway-campaign-c-green",
  red: "thinkway-campaign-c-red",
  gray: "thinkway-campaign-c-gray",
} as const;

function MetricItem({ label, value, tone }: MetricDef) {
  return (
    <div className="thinkway-campaign-metric-item">
      <div className="thinkway-campaign-metric-lbl">{label}</div>
      <div
        className={cn(
          "thinkway-campaign-metric-val tabular-nums",
          tone ? TONE_CLASS[tone] : undefined
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function CampaignKpiStrip({
  workspace,
  operationalDeliverableCount,
}: CampaignKpiStripProps) {
  const { financials, lines, deliverables } = workspace;
  const currency = workspace.currency_code;
  const deliverableKpi = operationalDeliverableCount ?? deliverables.length;

  const budgetTone: MetricDef["tone"] = financials.po_exceeded
    ? "red"
    : workspace.po.po_status === "near_limit"
      ? "amber"
      : "amber";

  const financialMetrics: MetricDef[] = [
    {
      id: "budget",
      label: "Budget (PO)",
      value: formatMoney(financials.budget, currency),
      tone: budgetTone,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.revenue, currency),
      tone: "blue",
    },
    {
      id: "cost",
      label: "Cost",
      value: formatMoney(financials.cost, currency),
    },
    {
      id: "gp",
      label: "GP",
      value: formatMoney(financials.gp, currency),
      tone: financials.gp < 0 ? "red" : "green",
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
    },
  ];

  const operationalMetrics: MetricDef[] = [
    {
      id: "assignments",
      label: "Assignments",
      value: String(lines.length),
    },
    {
      id: "deliverables",
      label: "Deliverables",
      value: String(deliverableKpi),
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatMoney(financials.billing_outstanding, currency),
      tone: financials.billing_outstanding > 0 ? "red" : undefined,
    },
  ];

  return (
    <div className="thinkway-campaign-metrics-band">
      <div className="thinkway-campaign-metrics-section">
        <div className="thinkway-campaign-metrics-label">Financials</div>
        <div className="thinkway-campaign-metrics-row">
          {financialMetrics.map((metric) => (
            <MetricItem key={metric.id} {...metric} />
          ))}
        </div>
      </div>
      <div className="thinkway-campaign-metrics-section">
        <div className="thinkway-campaign-metrics-label">Operations</div>
        <div className="thinkway-campaign-metrics-row">
          {operationalMetrics.map((metric) => (
            <MetricItem key={metric.id} {...metric} />
          ))}
        </div>
      </div>
    </div>
  );
}
