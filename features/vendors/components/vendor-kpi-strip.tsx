"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";

type VendorKpiStripProps = {
  workspace: VendorWorkspace;
};

export function VendorKpiStrip({ workspace }: VendorKpiStripProps) {
  const { counts, financials } = workspace;
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  const items = [
    { label: "Assignments", value: String(counts.assignments) },
    { label: "Campaigns", value: String(counts.campaigns) },
    { label: "Deliverables", value: String(counts.deliverables) },
    { label: "Platforms", value: String(counts.platforms) },
    { label: "Revenue", value: formatMoney(financials.total_revenue, currency) },
    { label: "GP", value: formatMoney(financials.total_gp, currency) },
    { label: "Margin", value: formatPercent(financials.margin_percent) },
    {
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
    },
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
