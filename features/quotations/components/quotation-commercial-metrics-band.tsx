"use client";

import { CommercialCurrencySelect } from "@/features/commercial/components/commercial-currency-select";
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { OriginalCurrencyTotals } from "@/features/quotations/quotation-row-math";
import { fromEgp } from "@/lib/commercial/fx-aggregation";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

type MetricDef = {
  label: string;
  value: string;
  unit?: string;
  tone?: "amber" | "blue" | "green" | "red";
  compact?: boolean;
  original?: string[];
};

function moneyParts(
  amountEgp: number,
  displayCurrency: string,
  fxRateToEgp: number
): { value: string; unit: string } {
  const amount = fromEgp(amountEgp, displayCurrency, fxRateToEgp);
  return {
    value: new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0),
    unit: (displayCurrency || "EGP").toUpperCase(),
  };
}

function originalLabels(
  rows: OriginalCurrencyTotals[],
  field: keyof Pick<OriginalCurrencyTotals, "totalCost" | "totalClientCost" | "totalGpMargin">
): string[] {
  return rows
    .filter((row) => Number.isFinite(row[field]) && row[field] !== 0)
    .map((row) => formatMoneyKpi(row[field], row.currency));
}

function MetricItem({ label, value, unit, tone, compact, original }: MetricDef) {
  const toneClass =
    tone === "green" ? "g" : tone === "red" ? "r" : tone === "amber" ? "y" : compact ? "s" : undefined;
  return (
    <div>
      <i>{label}</i>
      <b className={toneClass}>
        {value}
        {unit ? ` ${unit}` : ""}
      </b>
      {original?.length ? (
        <span className="orig block text-[10px] text-[var(--tw-mut)]" aria-label={`${label} original currency`}>
          {original.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalCommercialGpEgp: number;
  totalAgencyFeeEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  totalPmPct: number;
  gpTargetPct: number;
  creatorCount: number;
  version: string;
  validDaysRemaining: number | null;
  displayCurrency: string;
  displayFxRateToEgp: number;
  originalTotals?: OriginalCurrencyTotals[];
  onDisplayCurrencyChange?: (currency: string) => void;
  currencyDisabled?: boolean;
};

export function QuotationCommercialMetricsBand({
  totalCostEgp,
  totalRevenueEgp,
  totalCommercialGpEgp,
  totalAgencyFeeEgp,
  totalGpValueEgp,
  totalGpPct,
  totalPmPct,
  gpTargetPct,
  creatorCount,
  version,
  validDaysRemaining,
  displayCurrency,
  displayFxRateToEgp,
  originalTotals = [],
  onDisplayCurrencyChange,
  currencyDisabled,
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

  const base = moneyParts(totalCostEgp, displayCurrency, displayFxRateToEgp);
  const client = moneyParts(totalRevenueEgp, displayCurrency, displayFxRateToEgp);
  const gp = moneyParts(totalGpValueEgp, displayCurrency, displayFxRateToEgp);
  const commercialGp = moneyParts(
    totalCommercialGpEgp,
    displayCurrency,
    displayFxRateToEgp
  );
  const agencyFee = moneyParts(totalAgencyFeeEgp, displayCurrency, displayFxRateToEgp);
  const gpValuesDisagree = Math.abs(totalGpValueEgp - totalCommercialGpEgp) >= 0.01;

  return (
    <div className="discovery-suite px-4 pt-1">
    <div className="tw-ms2" aria-label="Quotation commercial metrics">
      <div className="metric metric--currency flex flex-col justify-center gap-1 py-[9px]">
        <CommercialCurrencySelect
          label="CCY"
          layout="metric"
          value={displayCurrency}
          onChange={onDisplayCurrencyChange ?? (() => undefined)}
          disabled={currencyDisabled || !onDisplayCurrencyChange}
        />
      </div>
      <MetricItem
        label="Base cost"
        value={base.value}
        unit={base.unit}
        original={originalLabels(originalTotals, "totalCost")}
      />
      <MetricItem
        label={QUOTATION_CLIENT_LABELS.totalClientCost}
        value={client.value}
        unit={client.unit}
        tone="blue"
        original={originalLabels(originalTotals, "totalClientCost")}
      />
      <MetricItem
        label={gpValuesDisagree ? "Agency-fee GP" : "GP margin"}
        value={gp.value}
        unit={gp.unit}
        tone={gpTone}
        original={originalLabels(originalTotals, "totalGpMargin")}
      />
      {gpValuesDisagree ? (
        <MetricItem
          label="Commercial GP"
          value={commercialGp.value}
          unit={commercialGp.unit}
          tone={totalCommercialGpEgp < 0 ? "red" : "green"}
        />
      ) : null}
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
    {gpValuesDisagree ? (
      <p className="px-3.5 pb-2 text-[10.5px] text-[var(--tw-mut)]">
        Agency-fee GP includes {agencyFee.value} {agencyFee.unit} in agency
        fees. The fee is added to what the client pays and is not counted as revenue.
      </p>
    ) : null}
    </div>
  );
}
