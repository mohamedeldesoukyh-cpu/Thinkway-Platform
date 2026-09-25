"use client";
import { BillingStyleKpis } from "@/components/finance/billing-style-surfaces";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

export function GroupKpiStrip({ workspace }: { workspace: GroupWorkspace }) {
  const { counts, financials } = workspace;
  return <BillingStyleKpis items={[
    { id: "clients", label: "Legal entities", value: String(counts.legal_entities) },
    { id: "brands", label: "Brands", value: String(counts.brands) },
    { id: "campaigns", label: "Campaigns", value: String(counts.campaigns) },
    { id: "revenue", label: "Total revenue", value: formatGroupMoney(financials.total_revenue) },
    { id: "gp", label: "Total GP", value: formatGroupMoney(financials.total_gp) },
    { id: "margin", label: "Margin", value: formatPercent(financials.margin_percent) },
  ]} />;
}
