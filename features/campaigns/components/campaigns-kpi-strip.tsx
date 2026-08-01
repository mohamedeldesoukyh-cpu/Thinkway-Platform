"use client";

import {
  CheckCircle2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoneyCompact } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

/** Module-level command KPIs for the Campaigns list (ISO KPI precision). */
export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  return (
    <PlatformV6KpiStrip
      className={cn("campaigns-module-kpi-strip", className)}
      items={[
        {
          id: "total",
          label: "CAMPAIGNS",
          value: String(kpis.total_campaigns),
          icon: CheckCircle2Icon,
          iconStroke: "#0057FF",
          iconBg: "var(--blue-light)",
        },
        {
          id: "revenue",
          label: "REVENUE",
          value: formatMoneyCompact(kpis.total_revenue, kpis.currency_code),
          icon: WalletIcon,
          iconStroke: "#059669",
          iconBg: "var(--green-bg)",
          valueClassName: "platform-v6-c-blue",
        },
        {
          id: "margin",
          label: "AVG MARGIN",
          value: `${kpis.avg_margin.toFixed(1)}%`,
          icon: TrendingUpIcon,
          iconStroke: "#f59e0b",
          iconBg: "var(--amber-bg)",
          valueClassName: "platform-v6-c-amber",
        },
        {
          id: "assignments",
          label: "ASSIGNMENTS",
          value: String(kpis.assignments),
          icon: UsersIcon,
          iconStroke: "#10b981",
          iconBg: "var(--green-bg)",
        },
      ]}
    />
  );
}
