"use client";

import {
  BriefcaseIcon,
  Building2Icon,
  LayersIcon,
  PercentIcon,
  TagIcon,
  TrendingUpIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

type GroupKpiStripProps = {
  workspace: GroupWorkspace;
};

export function GroupKpiStrip({ workspace }: GroupKpiStripProps) {
  const { counts, financials } = workspace;

  const items: KpiCarouselItem[] = [
    {
      id: "legal_entities",
      label: "Legal entities",
      value: String(counts.legal_entities),
      icon: Building2Icon,
      accentKey: "blue",
      valueSemantic: "count",
    },
    {
      id: "brands",
      label: "Brands",
      value: String(counts.brands),
      icon: TagIcon,
      accentKey: "purple",
      valueSemantic: "count",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      value: String(counts.campaigns),
      icon: LayersIcon,
      accentKey: "pink",
      valueSemantic: "count",
    },
    {
      id: "revenue",
      label: "Total revenue",
      value: formatGroupMoney(financials.total_revenue),
      icon: TrendingUpIcon,
      accentKey: "blue",
      valueSemantic: "revenue",
    },
    {
      id: "gp",
      label: "Total GP",
      value: formatGroupMoney(financials.total_gp),
      icon: BriefcaseIcon,
      accentKey: "purple",
      valueSemantic: "gp",
      valueNumeric: financials.total_gp,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accentKey: "green",
      valueSemantic: "margin",
      valueNumeric: financials.margin_percent,
    },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-1 backdrop-blur-sm">
      <KpiStrip items={items} showNavigation={false} />
    </div>
  );
}
