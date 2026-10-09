import { QuotationText, useQuotationLabel } from "./quotation-design-locale";

import { CommercialCurrencySelect } from "@/features/commercial/components/commercial-currency-select";
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
  internal?: boolean;
};

function moneyParts(
  amountEgp: number,
  displayCurrency: string,
  fxRateToEgp: number,
  projected?: number
): { value: string; unit: string } {
  const amount = projected ?? fromEgp(amountEgp, displayCurrency, fxRateToEgp);
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

function MetricItem({ label, value, unit, tone, compact, original, staged, internal }: MetricDef) {
  const toneClass =
    tone === "green" ? "g" : tone === "red" ? "r" : tone === "amber" ? "y" : compact ? "s" : undefined;
  return (
    <div className={`q-m ${internal ? "q-m--priv" : ""}`}>
      <u>
        {staged ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tw-dot warn" aria-hidden style={{ width: 8, height: 8, margin: 0 }} />
            <QuotationText>{label}</QuotationText>
            <span className="tw-p p-y" style={{ fontSize: 9, padding: "1px 5px" }}>
              <QuotationText>Draft</QuotationText></span>
          </span>
        ) : (
          <QuotationText>{label}</QuotationText>
        )}
      </u>
      <b className={value === "0" ? "z" : toneClass}>
        {unit ? <span className="cur">{unit}</span> : null}{value}
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
  projected?: ReturnType<typeof import("@/features/quotations/quotation-row-math").computeQuotationDisplayTotals>;
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalCommercialGpEgp: number;
  totalAgencyFeeEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  totalPmPct: number;
  gpTargetPct: number;
  creatorCount: number;
  /** Option lines — pack masthead shows Creators + Lines. */
  lineCount?: number;
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
  projected,
  totalCostEgp,
  totalRevenueEgp,
  totalCommercialGpEgp,
  totalAgencyFeeEgp,
  totalGpValueEgp,
  totalGpPct,
  totalPmPct,
  gpTargetPct,
  creatorCount,
  lineCount,
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
  const translate = useQuotationLabel();
  const gpTone: MetricDef["tone"] =
    totalGpValueEgp < 0 ? "red" : totalGpPct < gpTargetPct ? "amber" : "green";

  // Pack: masthead GP margin is yellow, GP % is red when agency-fee GP is the headline figure.
  const agencyFeeGpTone: MetricDef["tone"] = "amber";
  const agencyFeePctTone: MetricDef["tone"] = "red";

  const base = moneyParts(totalCostEgp, displayCurrency, displayFxRateToEgp, projected?.cost);
  const client = moneyParts(totalRevenueEgp, displayCurrency, displayFxRateToEgp, projected?.clientCost);
  const gp = moneyParts(totalGpValueEgp, displayCurrency, displayFxRateToEgp, projected?.margin);
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
    <div className="q-fin" aria-label="Quotation commercial metrics">
      <div className="q-fin-group">
      <div className="q-finlbl priv"><s aria-hidden /><QuotationText>Internal — never shown to the client</QuotationText></div>
      <MetricItem internal label="Base cost (internal creator / vendor cost)" value={base.value} unit={base.unit} original={originalLabels(originalTotals, "totalCost")} staged={hasDraftEdits} />
      <MetricItem internal label="GP amount" value={gp.value} unit={gp.unit} tone={showAgencyFeeConflict ? agencyFeeGpTone : gpTone} original={originalLabels(originalTotals, "totalGpMargin")} staged={hasDraftEdits} />
      <MetricItem internal label="GP %" value={`${(projected?.marginPct ?? totalGpPct).toFixed(1)}%`} tone={showAgencyFeeConflict ? agencyFeePctTone : gpTone} staged={hasDraftEdits} />
      <MetricItem internal label="Markup / FM %" value={`${(projected?.markupPct ?? totalPmPct).toFixed(1)}%`} />
      </div>
      <div className="q-fin-group">
      <div className="q-finlbl"><s aria-hidden /><QuotationText>Client-facing</QuotationText></div>
      <div className="q-m q-currency"><CommercialCurrencySelect label={translate("Display currency")} layout="metric" value={displayCurrency} onChange={onDisplayCurrencyChange ?? (() => undefined)} disabled={currencyDisabled || !onDisplayCurrencyChange} /></div>
      <MetricItem label="Client cost before agency fees" {...moneyParts(totalRevenueEgp - totalAgencyFeeEgp, displayCurrency, displayFxRateToEgp, projected?.revenue)} staged={hasDraftEdits} />
      <MetricItem label="Agency fees (AF)" {...moneyParts(totalAgencyFeeEgp, displayCurrency, displayFxRateToEgp, projected?.af)} staged={hasDraftEdits} />
      <MetricItem label="Total investment" value={client.value} unit={client.unit} original={originalLabels(originalTotals, "totalClientCost")} staged={hasDraftEdits} />
      {stagedVsSavedDisagree && savedClient && <MetricItem label="Saved client cost" value={savedClient.value} unit={savedClient.unit} tone="amber" />}
      </div>
    </div>

    {stagedVsSavedDisagree && savedClient ? (
      <p className="tw-note wrn mx-3.5 mb-2">
        Staged Client cost {client.value} {client.unit} vs saved{" "}
        {savedClient.value} {savedClient.unit}. Both figures are shown — Save commits the staged
        scratchpad; Discard restores saved line masters.
      </p>
    ) : null}
    </div>
  );
}
