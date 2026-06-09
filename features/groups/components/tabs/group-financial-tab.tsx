"use client";

import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

type GroupFinancialTabProps = {
  workspace: GroupWorkspace;
};

export function GroupFinancialTab({ workspace }: GroupFinancialTabProps) {
  const { financials } = workspace;

  const items = [
    { label: "Total revenue", value: formatGroupMoney(financials.total_revenue) },
    { label: "Total cost", value: formatGroupMoney(financials.total_cost) },
    { label: "Total GP", value: formatGroupMoney(financials.total_gp) },
    { label: "Margin", value: formatPercent(financials.margin_percent) },
    {
      label: "Billing outstanding",
      value: formatGroupMoney(financials.billing_outstanding),
    },
    { label: "Campaign count", value: String(financials.campaign_count) },
    {
      label: "Active campaigns",
      value: String(financials.active_campaign_count),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <CampaignFlatSection key={item.label} title={item.label}>
          <p className="font-heading text-2xl font-semibold tracking-tight">
            {item.value}
          </p>
        </CampaignFlatSection>
      ))}
    </div>
  );
}
