"use client";

import {
  CheckCircle2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  return (
    <PlatformV6KpiStrip
      className={cn(className)}
      items={[
        {
          id: "total",
          label: "TOTAL CAMPAIGNS",
          value: String(kpis.total_campaigns),
          icon: CheckCircle2Icon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          id: "revenue",
          label: "TOTAL REVENUE",
          value: formatMoney(kpis.total_revenue, kpis.currency_code),
          icon: WalletIcon,
          iconStroke: "#a855f7",
          iconBg: "#faf5ff",
          valueClassName: "platform-v6-c-blue",
        },
        {
          id: "margin",
          label: "AVG MARGIN",
          value: `${kpis.avg_margin.toFixed(1)}%`,
          icon: TrendingUpIcon,
          iconStroke: "#f59e0b",
          iconBg: "#fffbeb",
          valueClassName: "platform-v6-c-amber",
        },
        {
          id: "assignments",
          label: "ASSIGNMENTS",
          value: String(kpis.assignments),
          icon: UsersIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
      ]}
    />
  );
}
