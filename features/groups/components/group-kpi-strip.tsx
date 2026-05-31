"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

type GroupKpiStripProps = {
  workspace: GroupWorkspace;
};

const KPI_ITEMS = [
  { key: "legal_entities", label: "Legal entities" },
  { key: "brands", label: "Brands" },
  { key: "campaigns", label: "Campaigns" },
  { key: "revenue", label: "Total revenue" },
  { key: "gp", label: "Total GP" },
  { key: "margin", label: "Margin" },
] as const;

export function GroupKpiStrip({ workspace }: GroupKpiStripProps) {
  const { counts, financials } = workspace;

  const values: Record<(typeof KPI_ITEMS)[number]["key"], string> = {
    legal_entities: String(counts.legal_entities),
    brands: String(counts.brands),
    campaigns: String(counts.campaigns),
    revenue: formatGroupMoney(financials.total_revenue),
    gp: formatGroupMoney(financials.total_gp),
    margin: formatPercent(financials.margin_percent),
  };

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-1 backdrop-blur-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPI_ITEMS.map((item) => (
          <Card key={item.key} className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-heading text-lg font-semibold tracking-tight">
                {values[item.key]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
