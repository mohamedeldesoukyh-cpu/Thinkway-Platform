"use client";

import {
  ActivityIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  PercentIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";

type ExecutiveKpiStripProps = {
  strip: AnalyticsKpiStrip;
  loading?: boolean;
};

const EXECUTIVE_KPI_IDS = [
  "revenue",
  "gp",
  "margin",
  "invoiced",
  "collected",
  "outstanding",
  "vendor",
  "unbilled",
] as const;

type ExecutiveKpiId = (typeof EXECUTIVE_KPI_IDS)[number];

const KPI_STYLE: Record<
  ExecutiveKpiId,
  { icon: LucideIcon; iconStroke: string; iconBg: string; valueClassName?: string; accent?: string }
> = {
  revenue: {
    icon: TrendingUpIcon,
    iconStroke: "#0057FF",
    iconBg: "var(--blue-light)",
    valueClassName: "platform-v6-c-blue",
    accent: "#0057FF",
  },
  gp: {
    icon: TrendingUpIcon,
    iconStroke: "#a855f7",
    iconBg: "var(--purple-bg)",
    valueClassName: "platform-v6-c-purple",
    accent: "#a855f7",
  },
  margin: {
    icon: PercentIcon,
    iconStroke: "#ef4444",
    iconBg: "var(--red-bg)",
    accent: "#ef4444",
  },
  invoiced: {
    icon: CalendarIcon,
    iconStroke: "#10b981",
    iconBg: "var(--green-bg)",
    accent: "#10b981",
  },
  collected: {
    icon: CheckCircle2Icon,
    iconStroke: "#0057FF",
    iconBg: "var(--blue-light)",
    accent: "#0057FF",
  },
  outstanding: {
    icon: CircleAlertIcon,
    iconStroke: "#f59e0b",
    iconBg: "var(--amber-bg)",
    valueClassName: "platform-v6-c-amber",
    accent: "#f59e0b",
  },
  vendor: {
    icon: UsersIcon,
    iconStroke: "#a855f7",
    iconBg: "var(--purple-bg)",
    valueClassName: "platform-v6-c-purple",
    accent: "#a855f7",
  },
  unbilled: {
    icon: ActivityIcon,
    iconStroke: "#10b981",
    iconBg: "var(--green-bg)",
    accent: "#10b981",
  },
};

function formatCardValue(card: AnalyticsKpiCard): string {
  if (card.id === "margin") {
    return `${card.value.toFixed(1)}%`;
  }
  return card.formatted_value;
}

export function ExecutiveKpiStrip({ strip, loading }: ExecutiveKpiStripProps) {
  if (loading) {
    return (
      <div className="platform-v6-kpi-strip platform-v6-kpi-strip--executive">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="platform-v6-kpi-cell animate-pulse">
            <div className="platform-v6-kpi-lbl">&nbsp;</div>
            <div className="platform-v6-kpi-val">&nbsp;</div>
          </div>
        ))}
      </div>
    );
  }

  const cards = strip.cards.filter((card) =>
    EXECUTIVE_KPI_IDS.includes(card.id as ExecutiveKpiId)
  );

  const items = cards.map((card) => {
    const style = KPI_STYLE[card.id as ExecutiveKpiId] ?? {
      icon: WalletIcon,
      iconStroke: "#2563eb",
      iconBg: "#eff6ff",
    };
    return {
      id: card.id,
      label: card.label.toUpperCase(),
      value: formatCardValue(card),
      icon: style.icon,
      iconStroke: style.iconStroke,
      iconBg: style.iconBg,
      valueClassName: style.valueClassName,
      accent: style.accent,
    };
  });

  return (
    <>
      {strip.currency.is_mixed_currency ? (
        <p className="platform-v6-mixed-currency">
          {strip.currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <PlatformV6KpiStrip
        className="platform-v6-kpi-strip--executive mb-5"
        items={items}
        layout="flex"
      />
    </>
  );
}
