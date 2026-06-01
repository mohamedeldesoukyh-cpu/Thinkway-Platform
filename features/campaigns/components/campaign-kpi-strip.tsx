"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

type CampaignKpiStripProps = {
  workspace: CampaignWorkspace;
};

export function CampaignKpiStrip({ workspace }: CampaignKpiStripProps) {
  const { financials, lines, vendors, deliverables } = workspace;
  const currency = workspace.currency_code;

  const items = [
    { label: "Budget (PO)", value: formatMoney(financials.budget, currency) },
    { label: "Revenue", value: formatMoney(financials.revenue, currency) },
    { label: "Cost", value: formatMoney(financials.cost, currency) },
    { label: "GP", value: formatMoney(financials.gp, currency) },
    { label: "Margin", value: formatPercent(financials.margin_percent) },
    { label: "Lines", value: String(lines.length) },
    { label: "Vendors", value: String(vendors.length) },
    { label: "Deliverables", value: String(deliverables.length) },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-1 backdrop-blur-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {items.map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-heading text-base font-semibold tracking-tight">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
