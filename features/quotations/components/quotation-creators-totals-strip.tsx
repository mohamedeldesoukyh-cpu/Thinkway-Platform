"use client";

import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";
import { cn } from "@/lib/utils";

type Props = {
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  gpTargetPct: number;
};

function egp(n: number, signed = false): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? Math.abs(n) : 0);
  const prefix = signed && n >= 0 ? "+" : signed && n < 0 ? "-" : "";
  return `${prefix}${formatted} EGP`;
}

export function QuotationCreatorsTotalsStrip({
  totalCostEgp,
  totalRevenueEgp,
  totalGpValueEgp,
  totalGpPct,
  gpTargetPct,
}: Props) {
  const gpClass = gpHealthTextClass({
    gpValueEgp: totalGpValueEgp,
    gpPct: totalGpPct,
    targetPct: gpTargetPct,
  });

  const cells = [
    { label: "Base cost", value: egp(totalCostEgp), className: undefined },
    {
      label: QUOTATION_CLIENT_LABELS.totalClientCost,
      value: egp(totalRevenueEgp),
      className: "thinkway-campaign-c-blue",
    },
    {
      label: "GP margin",
      value: egp(totalGpValueEgp, true),
      className: cn(
        totalGpValueEgp < 0 ? "thinkway-campaign-c-red" : "thinkway-campaign-c-green",
        gpClass
      ),
    },
    {
      label: "GP%",
      value: `${totalGpPct.toFixed(1)}%`,
      className: gpClass,
    },
  ];

  return (
    <div className="thinkway-campaign-kpi-strip thinkway-campaign-kpi-strip--4col">
      {cells.map((cell) => (
        <div key={cell.label} className="thinkway-campaign-kpi-cell">
          <div className="thinkway-campaign-kpi-lbl">{cell.label}</div>
          <div className={cn("thinkway-campaign-kpi-val tabular-nums", cell.className)}>
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}
