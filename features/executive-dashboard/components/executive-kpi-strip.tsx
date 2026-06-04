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

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";

type ExecutiveKpiStripProps = {
  strip: AnalyticsKpiStrip;
  loading?: boolean;
};

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
} as const;

const ACCENT_CYCLE = [
  ACCENT_TILE.blue,
  ACCENT_TILE.purple,
  ACCENT_TILE.pink,
  ACCENT_TILE.green,
] as const;

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
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden pb-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-[168px] shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5"
          >
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = strip.cards.map((card, index) => {
    const Icon = KPI_ICONS[card.id] ?? WalletIcon;
    const trend = trendLabel(card);
    return {
      id: card.id,
      label: trend ? `${card.label} (${trend})` : card.label,
      value: formatCardValue(card),
      icon: Icon,
      accentClass: ACCENT_CYCLE[index % ACCENT_CYCLE.length],
      valueAlert:
        card.alert === "danger"
          ? ("danger" as const)
          : card.alert === "warning"
            ? ("warning" as const)
            : undefined,
    };
  });

  return (
    <div className="space-y-2">
      {strip.currency.is_mixed_currency ? (
        <p className="text-[11px] text-muted-foreground">
          {strip.currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <KpiCarousel items={items} showNavigation={false} className="pb-1" />
    </div>
  );
}
