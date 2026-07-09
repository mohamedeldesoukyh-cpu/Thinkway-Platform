"use client";

import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { cn } from "@/lib/utils";

type MetricDef = {
  id: string;
  label: string;
  value: string;
  tone?: "amber" | "blue" | "green" | "red" | "gray";
};

const TONE_CLASS = {
  amber: "thinkway-campaign-c-amber",
  blue: "thinkway-campaign-c-blue",
  green: "thinkway-campaign-c-green",
  red: "thinkway-campaign-c-red",
  gray: "thinkway-campaign-c-gray",
} as const;

function egp(n: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function MetricItem({ label, value, tone }: MetricDef) {
  return (
    <div className="thinkway-campaign-metric-item">
      <div className="thinkway-campaign-metric-lbl">{label}</div>
      <div
        className={cn(
          "thinkway-campaign-metric-val tabular-nums",
          tone ? TONE_CLASS[tone] : undefined
        )}
      >
        {value}
      </div>
    </div>
  );
}

type Props = {
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  totalPmPct: number;
  gpTargetPct: number;
  creatorCount: number;
  version: string;
  validDaysRemaining: number | null;
};

export function QuotationCommercialMetricsBand({
  totalCostEgp,
  totalRevenueEgp,
  totalGpValueEgp,
  totalGpPct,
  totalPmPct,
  gpTargetPct,
  creatorCount,
  version,
  validDaysRemaining,
}: Props) {
  const gpTone: MetricDef["tone"] =
    totalGpValueEgp < 0 ? "red" : totalGpPct < gpTargetPct ? "amber" : "green";

  const commercialMetrics: MetricDef[] = [
    { id: "base", label: "Base cost", value: egp(totalCostEgp) },
    {
      id: "total",
      label: QUOTATION_CLIENT_LABELS.totalClientCost,
      value: egp(totalRevenueEgp),
      tone: "blue",
    },
    {
      id: "gp",
      label: "GP margin",
      value: egp(totalGpValueEgp),
      tone: gpTone,
    },
    {
      id: "gp_pct",
      label: "GP%",
      value: `${totalGpPct.toFixed(1)}%`,
      tone: gpTone,
    },
    {
      id: "pm_pct",
      label: "PM%",
      value: `${totalPmPct.toFixed(1)}%`,
      tone: gpTone,
    },
  ];

  const daysTone: MetricDef["tone"] =
    validDaysRemaining == null
      ? undefined
      : validDaysRemaining <= 0
        ? "red"
        : validDaysRemaining <= 7
          ? "amber"
          : undefined;

  const documentMetrics: MetricDef[] = [
    { id: "version", label: "Version", value: version },
    { id: "creators", label: "Creators", value: String(creatorCount) },
    {
      id: "days",
      label: "Days left",
      value:
        validDaysRemaining == null
          ? "—"
          : validDaysRemaining < 0
            ? "Expired"
            : String(validDaysRemaining),
      tone: daysTone,
    },
  ];

  return (
    <div className="thinkway-campaign-metrics-band">
      <div className="thinkway-campaign-metrics-section">
        <div className="thinkway-campaign-metrics-label">Commercial</div>
        <div className="thinkway-campaign-metrics-row">
          {commercialMetrics.map((metric) => (
            <MetricItem key={metric.id} {...metric} />
          ))}
        </div>
      </div>
      <div className="thinkway-campaign-metrics-section">
        <div className="thinkway-campaign-metrics-label">Document</div>
        <div className="thinkway-campaign-metrics-row">
          {documentMetrics.map((metric) => (
            <MetricItem key={metric.id} {...metric} />
          ))}
        </div>
      </div>
    </div>
  );
}
