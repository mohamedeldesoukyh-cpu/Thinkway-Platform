"use client";

import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { sumIoGatedAssignmentBillable } from "@/lib/billing/queue-eligibility";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import { cn } from "@/lib/utils";

type CampaignBillingKpiStripProps = {
  workspace: CampaignWorkspace;
  /** When set, revenue / PO consumed reflect Vendor-IO-gated billable only. */
  operationalRows?: OperationalBillingRow[];
};

type BillingKpiCellProps = {
  label: string;
  value: string;
  tone?: "amber" | "blue" | "red";
};

function BillingKpiCell({ label, value, tone }: BillingKpiCellProps) {
  return (
    <div className="thinkway-campaign-kpi-cell">
      <div className="thinkway-campaign-kpi-lbl">{label}</div>
      <div
        className={cn(
          "thinkway-campaign-kpi-val tabular-nums",
          tone === "amber" && "thinkway-campaign-c-amber",
          tone === "blue" && "thinkway-campaign-c-blue",
          tone === "red" && "thinkway-campaign-c-red"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function CampaignBillingKpiStrip({
  workspace,
  operationalRows,
}: CampaignBillingKpiStripProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;

  const ioGatedBillable =
    operationalRows && operationalRows.length > 0
      ? sumIoGatedAssignmentBillable(operationalRows)
      : null;
  const billingRevenue = ioGatedBillable ?? financials.revenue;
  const billingPoConsumed = ioGatedBillable ?? financials.po_consumed;
  const billingRemainingPo = financials.po_total - billingPoConsumed;

  return (
    <div className="thinkway-campaign-kpi-strip thinkway-campaign-kpi-strip--billing">
      <BillingKpiCell
        label="PO total"
        value={formatMoney(financials.po_total, currency)}
        tone="amber"
      />
      <BillingKpiCell
        label="PO consumed"
        value={formatMoney(billingPoConsumed, currency)}
        tone="amber"
      />
      <BillingKpiCell
        label="Remaining PO"
        value={formatMoney(billingRemainingPo, currency)}
      />
      <BillingKpiCell
        label="Revenue"
        value={formatMoney(billingRevenue, currency)}
        tone="blue"
      />
      <BillingKpiCell
        label="Collected"
        value={formatMoney(financials.collected, currency)}
      />
      <BillingKpiCell
        label="Outstanding"
        value={formatMoney(financials.billing_outstanding, currency)}
        tone={financials.billing_outstanding > 0 ? "red" : undefined}
      />
      <BillingKpiCell
        label="Margin"
        value={formatPercent(financials.margin_percent ?? 0)}
      />
    </div>
  );
}
