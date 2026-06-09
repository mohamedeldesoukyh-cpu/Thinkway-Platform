"use client";

import {
  BriefcaseIcon,
  Building2Icon,
  LayersIcon,
  PercentIcon,
  TagIcon,
  TrendingUpIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

type GroupKpiStripProps = {
  workspace: GroupWorkspace;
};

export function GroupKpiStrip({ workspace }: GroupKpiStripProps) {
  const { counts, financials } = workspace;

  const items = [
    {
      id: "legal_entities",
      label: "Legal entities",
      value: String(counts.legal_entities),
      icon: Building2Icon,
      accentClass: "bg-brand-blue/10 text-brand-blue",
    },
    {
      id: "brands",
      label: "Brands",
      value: String(counts.brands),
      icon: TagIcon,
      accentClass: "bg-brand-purple/10 text-brand-purple",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      value: String(counts.campaigns),
      icon: LayersIcon,
      accentClass: "bg-brand-pink/10 text-brand-pink",
    },
    {
      id: "revenue",
      label: "Total revenue",
      value: formatGroupMoney(financials.total_revenue),
      icon: TrendingUpIcon,
      accentClass: "bg-brand-blue/10 text-brand-blue",
    },
    {
      id: "gp",
      label: "Total GP",
      value: formatGroupMoney(financials.total_gp),
      icon: BriefcaseIcon,
      accentClass: "bg-brand-purple/10 text-brand-purple",
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accentClass: "bg-success/10 text-success",
    },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-1 backdrop-blur-sm">
      <KpiCarousel items={items} showNavigation={false} />
    </div>
  );
}
