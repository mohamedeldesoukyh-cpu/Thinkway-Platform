"use client";

import {
  FileTextIcon,
  LayersIcon,
  MegaphoneIcon,
  PercentIcon,
  Share2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

type VendorKpiStripProps = {
  workspace: VendorWorkspace;
  className?: string;
};

export function VendorKpiStrip({ workspace, className }: VendorKpiStripProps) {
  const { counts, financials } = workspace;
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  return (
    <PlatformV6KpiStrip
      className={cn("platform-v6-kpi-strip--executive mb-0", className)}
      items={[
        {
          id: "assignments",
          label: "Assignments",
          value: String(counts.assignments),
          icon: UsersIcon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          id: "campaigns",
          label: "Campaigns",
          value: String(counts.campaigns),
          icon: MegaphoneIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
        {
          id: "deliverables",
          label: "Deliverables",
          value: String(counts.deliverables),
          icon: LayersIcon,
          iconStroke: "#a855f7",
          iconBg: "#faf5ff",
        },
        {
          id: "platforms",
          label: "Platforms",
          value: String(counts.platforms),
          icon: Share2Icon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
        {
          id: "revenue",
          label: "Revenue",
          value: formatMoney(financials.total_revenue, currency),
          icon: TrendingUpIcon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
          valueClassName: "platform-v6-c-blue !text-[12px]",
        },
        {
          id: "gp",
          label: "GP",
          value: formatMoney(financials.total_gp, currency),
          icon: WalletIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
          valueClassName: "platform-v6-c-green !text-[12px]",
        },
        {
          id: "margin",
          label: "Margin",
          value: formatPercent(financials.margin_percent),
          icon: PercentIcon,
          iconStroke: "#f59e0b",
          iconBg: "#fffbeb",
        },
        {
          id: "payout",
          label: "Pending payout",
          value: formatMoney(financials.pending_payout, currency),
          icon: FileTextIcon,
          iconStroke: "#ec4899",
          iconBg: "#fdf2f8",
          valueClassName: "!text-[12px]",
        },
      ]}
    />
  );
}
