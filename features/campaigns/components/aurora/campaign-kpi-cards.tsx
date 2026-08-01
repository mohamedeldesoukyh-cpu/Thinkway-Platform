"use client";

import type { ReactNode } from "react";
import {
  WalletIcon,
  ReceiptIcon,
  TrendingUpIcon,
  PercentIcon,
} from "lucide-react";

import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignKpiCardsProps = {
  workspace: CampaignWorkspace;
  className?: string;
};

type KpiCardDef = {
  id: string;
  label: string;
  value: string;
  sub: ReactNode;
  icon: ReactNode;
  tint: "blue" | "slate" | "emer" | "violet";
  valueClassName?: string;
};

/** Aurora KPI cards — live financials; ISO currency, KPI precision (no decimals). */
export function CampaignKpiCards({ workspace, className }: CampaignKpiCardsProps) {
  const { financials, lines } = workspace;
  const currency = workspace.currency_code;
  const marginHealthy = financials.margin_percent >= 20;
  const marginWeak = financials.margin_percent < 10;

  const cards: KpiCardDef[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoneyCompact(financials.revenue, currency),
      sub: "Billable campaign value",
      tint: "blue",
      icon: <WalletIcon aria-hidden />,
    },
    {
      id: "cost",
      label: "Cost",
      value: formatMoneyCompact(financials.cost, currency),
      sub: "Committed vendor cost",
      tint: "slate",
      icon: <ReceiptIcon aria-hidden />,
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: formatMoneyCompact(financials.gp, currency),
      valueClassName:
        financials.gp < 0
          ? "text-[var(--camp-red-text)]"
          : "text-[var(--camp-green-text)]",
      sub: `${formatPercent(financials.margin_percent)} GP`,
      tint: "emer",
      icon: <TrendingUpIcon aria-hidden />,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      sub: (
        <>
          <span
            className={cn(
              "thinkway-aurora-chip-sm",
              marginWeak
                ? "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]"
                : marginHealthy
                  ? "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]"
                  : "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]"
            )}
          >
            {marginWeak ? "Watch" : marginHealthy ? "Healthy campaign" : "Moderate"}
          </span>
          <span>· {lines.length} creators</span>
        </>
      ),
      tint: "violet",
      icon: <PercentIcon aria-hidden />,
    },
  ];

  return (
    <div className={cn("thinkway-aurora-kpis", className)} role="group" aria-label="Campaign KPIs">
      {cards.map((card) => (
        <article key={card.id} className="thinkway-aurora-kpi">
          <div className="thinkway-aurora-kpi-ktop">
            <div className={cn("thinkway-aurora-kpi-ic", `tint-${card.tint}`)}>{card.icon}</div>
          </div>
          <div className="thinkway-aurora-kpi-klab">{card.label}</div>
          <div className={cn("thinkway-aurora-kpi-kval tabular-nums", card.valueClassName)}>
            {card.value}
          </div>
          <div className="thinkway-aurora-kpi-ksub">{card.sub}</div>
        </article>
      ))}
    </div>
  );
}
