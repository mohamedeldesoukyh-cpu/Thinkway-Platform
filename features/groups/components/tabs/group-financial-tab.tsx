"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
