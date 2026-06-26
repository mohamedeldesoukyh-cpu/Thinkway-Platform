"use client";

import {
  FileTextIcon,
  MegaphoneIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { resolveKpiAccentByIndex } from "@/components/shared/kpi/kpi-utils";
import { KpiStrip } from "@/components/shared/kpi/kpi-strip";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";

type ExecutiveKpiStripProps = {
  strip: AnalyticsKpiStrip;
  loading?: boolean;
};

const KPI_ICONS: Record<string, LucideIcon> = {
  revenue: TrendingUpIcon,
  gp: TrendingUpIcon,
  margin: PercentIcon,
  invoiced: FileTextIcon,
  collected: WalletIcon,
  outstanding: ReceiptIcon,
  vendor: UsersIcon,
  unbilled: ReceiptIcon,
  po_remaining: WalletIcon,
  active_campaigns: MegaphoneIcon,
};

function formatCardValue(card: AnalyticsKpiCard): string {
  if (card.id === "margin") {
    return `${card.value.toFixed(1)}%`;
  }
  if (card.id === "active_campaigns") {
    return String(Math.round(card.value));
  }
  return card.formatted_value;
}

function trendLabel(card: AnalyticsKpiCard): string | undefined {
  if (card.trend_percent == null) return undefined;
  const sign = card.trend_percent > 0 ? "+" : card.trend_percent < 0 ? "−" : "";
  return `${sign}${Math.abs(card.trend_percent).toFixed(1)}%`;
}

export function ExecutiveKpiStrip({ strip, loading }: ExecutiveKpiStripProps) {
  const items = strip.cards.map((card, index) => {
    const Icon = KPI_ICONS[card.id] ?? WalletIcon;
    const trend = trendLabel(card);
    const valueSemantic =
      card.id === "revenue"
        ? ("revenue" as const)
        : card.id === "gp"
          ? ("gp" as const)
          : card.id === "margin"
            ? ("margin" as const)
            : card.id === "active_campaigns"
              ? ("count" as const)
              : undefined;
    return {
      id: card.id,
      label: trend ? `${card.label} (${trend})` : card.label,
      value: formatCardValue(card),
      icon: Icon,
      accentClass: resolveKpiAccentByIndex(index),
      valueSemantic,
      valueNumeric:
        card.id === "gp" || card.id === "margin" ? card.value : undefined,
      valueAlert:
        card.alert === "danger"
          ? ("danger" as const)
          : card.alert === "warning"
            ? ("warning" as const)
            : undefined,
    };
  });

  return (
    <KpiStrip
      items={items}
      showNavigation={false}
      loading={loading}
      className="pb-1"
      mixedCurrencyNotice={
        strip.currency.is_mixed_currency
          ? `${strip.currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.`
          : undefined
      }
    />
  );
}
