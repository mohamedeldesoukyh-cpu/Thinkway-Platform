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
  /** Uncommitted scratchpad figure — wrn attention (dot + Draft chip). */
  staged?: boolean;
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

function MetricItem({ label, value, unit, tone, compact, original, staged }: MetricDef) {
  const toneClass =
    tone === "green" ? "g" : tone === "red" ? "r" : tone === "amber" ? "y" : compact ? "s" : undefined;
  return (
    <div>
      <i>
        {staged ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
            {label}
            <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
              Draft
            </span>
          </span>
        ) : (
          label
        )}
      </i>
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
  /** True when workspace drafts / line-pending differ from last-saved SSOT. */
  hasDraftEdits?: boolean;
  /** Last-saved SSOT client cost (EGP) — shown beside staged when they disagree. */
  savedClientCostEgp?: number | null;
  onOpenCommercialWorkspace?: () => void;
  /** When true, omit the outer discovery-suite wrapper (metrics live inside tw-mast). */
  embedded?: boolean;
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
  hasDraftEdits = false,
  savedClientCostEgp = null,
  onOpenCommercialWorkspace,
  embedded = false,
}: Props) {
  const gpTone: MetricDef["tone"] =
    totalGpValueEgp < 0 ? "red" : totalGpPct < gpTargetPct ? "amber" : "green";

  // Pack: masthead GP margin is yellow, GP % is red when agency-fee GP is the headline figure.
  const agencyFeeGpTone: MetricDef["tone"] = "amber";
  const agencyFeePctTone: MetricDef["tone"] = "red";

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
  const showAgencyFeeConflict = gpValuesDisagree || totalAgencyFeeEgp > 0.01;

  const savedClient =
    savedClientCostEgp != null
      ? moneyParts(savedClientCostEgp, displayCurrency, displayFxRateToEgp)
      : null;
  const stagedVsSavedDisagree =
    hasDraftEdits &&
    savedClientCostEgp != null &&
    Math.abs(totalRevenueEgp - savedClientCostEgp) >= 0.01;

  return (
    <div className={embedded ? undefined : "discovery-suite px-4 pt-1"}>
    {hasDraftEdits ? (
      <p className="tw-note wrn mx-3.5 mb-2" role="status">
        <span className="tw-live" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
        <b>Draft edits pending</b> — masthead and Creators grid show uncommitted scratchpad values.
        Last-saved Client cost stays{" "}
        {savedClient ? (
          <b>
            {savedClient.value} {savedClient.unit}
          </b>
        ) : (
          "unchanged"
        )}{" "}
        until Save.
        {onOpenCommercialWorkspace ? (
          <>
            {" "}
            <button type="button" className="tw-b sm" onClick={onOpenCommercialWorkspace}>
              Open Commercial Workspace
            </button>
          </>
        ) : null}
      </p>
    ) : null}
    <div className="tw-ms2" aria-label="Quotation commercial metrics">
      <div className="metric metric--currency flex flex-col justify-center gap-1 py-[9px]">
        <CommercialCurrencySelect
          label="Ccy"
          layout="metric"
          value={displayCurrency}
          onChange={onDisplayCurrencyChange ?? (() => undefined)}
          disabled={currencyDisabled || !onDisplayCurrencyChange}
        />
      </div>
      <MetricItem
        label="Base cost"
        value={base.value}
        original={originalLabels(originalTotals, "totalCost")}
        staged={hasDraftEdits}
      />
      <MetricItem
        label={QUOTATION_CLIENT_LABELS.totalClientCost}
        value={client.value}
        original={originalLabels(originalTotals, "totalClientCost")}
        staged={hasDraftEdits}
      />
      {stagedVsSavedDisagree && savedClient ? (
        <MetricItem
          label="Saved client cost"
          value={savedClient.value}
          tone="amber"
        />
      ) : null}
      <MetricItem
        label="GP margin"
        value={gp.value}
        tone={showAgencyFeeConflict ? agencyFeeGpTone : gpTone}
        original={originalLabels(originalTotals, "totalGpMargin")}
        staged={hasDraftEdits}
      />
      {showAgencyFeeConflict ? (
        <MetricItem
          label="Commercial GP"
          value={commercialGp.value}
          tone="red"
        />
      ) : null}
      <MetricItem
        label="GP %"
        value={`${totalGpPct.toFixed(1)}%`}
        tone={showAgencyFeeConflict ? agencyFeePctTone : gpTone}
        staged={hasDraftEdits}
      />
      <MetricItem label="FM %" value={`${totalPmPct.toFixed(1)}%`} />
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
    {stagedVsSavedDisagree && savedClient ? (
      <p className="tw-note wrn mx-3.5 mb-2">
        Staged Client cost {client.value} {client.unit} vs saved{" "}
        {savedClient.value} {savedClient.unit}. Both figures are shown — Save commits the staged
        scratchpad; Discard restores saved line masters.
      </p>
    ) : null}
    {showAgencyFeeConflict ? (
      <p className="tw-note wrn mx-3.5 mb-2">
        Masthead GP margin {gp.value} / {totalGpPct.toFixed(1)}% includes{" "}
        {agencyFee.value} in <b>agency fee</b> — added to what the client pays, never
        counted as revenue. The approved block and Commercial Workspace use revenue
        minus cost with AF excluded ({commercialGp.value} /{" "}
        {totalRevenueEgp > 0
          ? ((totalCommercialGpEgp / totalRevenueEgp) * 100).toFixed(1)
          : "0.0"}
        %). Both figures are correct.
      </p>
    ) : null}
    </div>
  );
}
