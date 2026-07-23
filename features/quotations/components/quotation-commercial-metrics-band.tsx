"use client";

import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { cn } from "@/lib/utils";

type MetricDef = {
  label: string;
  value: string;
  unit?: string;
  tone?: "amber" | "blue" | "green" | "red";
  compact?: boolean;
};

function egpParts(n: number): { value: string; unit: string } {
  return {
    value: new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0),
    unit: "EGP",
  };
}

function MetricItem({ label, value, unit, tone, compact }: MetricDef) {
  return (
    <div className="metric">
      <div className="l">{label}</div>
      <div
        className={cn(
          "v",
          compact && "sm",
          tone === "blue" && "blue",
          tone === "amber" && "amber",
          tone === "green" && "green",
          tone === "red" && "red"
        )}
      >
        {value}
        {unit ? <span className="u"> {unit}</span> : null}
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

  const daysTone: MetricDef["tone"] =
    validDaysRemaining == null
      ? "blue"
      : validDaysRemaining <= 0
        ? "red"
        : validDaysRemaining <= 7
          ? "amber"
          : "blue";

  const base = egpParts(totalCostEgp);
  const client = egpParts(totalRevenueEgp);
  const gp = egpParts(totalGpValueEgp);

  return (
    <div className="metricsband" aria-label="Quotation commercial metrics">
      <MetricItem label="Base cost" value={base.value} unit={base.unit} />
      <MetricItem
        label={QUOTATION_CLIENT_LABELS.totalClientCost}
        value={client.value}
        unit={client.unit}
        tone="blue"
      />
      <MetricItem label="GP margin" value={gp.value} unit={gp.unit} tone={gpTone} />
      <MetricItem label="GP %" value={`${totalGpPct.toFixed(1)}%`} tone={gpTone} />
      <MetricItem label="PM %" value={`${totalPmPct.toFixed(1)}%`} tone={gpTone} />
      <MetricItem label="Version" value={version} compact />
      <MetricItem label="Creators" value={String(creatorCount)} />
      <MetricItem
        label="Days left"
        value={
          validDaysRemaining == null
            ? "—"
            : validDaysRemaining < 0
              ? "Expired"
              : String(validDaysRemaining)
        }
        tone={daysTone}
      />
    </div>
  );
}
