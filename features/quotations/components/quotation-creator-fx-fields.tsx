"use client";

import { useId } from "react";
import { QuotationDecimalInput } from "./quotation-decimal-input";
import { creatorFxAmount, creatorFxRate, makeCreatorFx, readCreatorFx } from "@/lib/commercial/creator-fx";
import { computeQuotationRowComputed, type QuotationRowDraft } from "@/features/quotations/quotation-row-math";

export function QuotationCreatorFxFields({ draft, displayCurrency = "EGP", displayFxRateToEgp = 1, disabled, onChange }: {
  draft: QuotationRowDraft;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
  disabled?: boolean;
  onChange: (patch: Partial<QuotationRowDraft>) => void;
}) {
  const id = useId();
  const computed = computeQuotationRowComputed(draft);
  const from = draft.costCurrency.toUpperCase();
  const to = displayCurrency.toUpperCase();
  const sameCurrency = from === to;
  const formatOriginal = (amount: number) => `${from} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} original`;
  return <div className="grid w-full gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-2">
    {(["cost", "revenue"] as const).map(side => {
      const key = side === "cost" ? "costFxOverride" : "revenueFxOverride";
      const original = side === "cost" ? draft.cost : computed.revenue;
      const custom = readCreatorFx(draft[key]);
      const conversion = { from, to, sourceRateToEgp: draft.fxRateToEgp, targetRateToEgp: displayFxRateToEgp, override: draft[key] };
      const rate = creatorFxRate(conversion);
      const title = side === "cost" ? "Cost" : "Revenue";
      const changeRate = (next: number) => {
        if (Math.abs(next - rate) < 1e-10) return;
        if (!Number.isFinite(next) || next <= 0 || next > 1e9 || sameCurrency) return;
        onChange({ [key]: makeCreatorFx(from, to, next, displayFxRateToEgp) });
      };
      return <div key={side} className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold">{title} conversion</span>
          <span className={custom ? "text-blue-600" : "text-muted-foreground"}>{custom ? "Custom rate" : "System rate"}</span>
        </div>
        <label htmlFor={`${id}-${side}-amount`} className="block text-xs">{title} ({to}, excluding VAT)</label>
        <QuotationDecimalInput id={`${id}-${side}-amount`} value={creatorFxAmount(original, conversion)}
          disabled={disabled || sameCurrency || original <= 0} blankWhenZero={false}
          isValid={amount => Number.isFinite(amount) && amount > 0 && amount / original <= 1e9}
          className="h-10 text-right tabular-nums" onCommit={amount => { if (Math.abs(amount - creatorFxAmount(original, conversion)) >= 0.005) changeRate(amount / original); }} />
        <div className="text-xs text-muted-foreground tabular-nums">{formatOriginal(original)}</div>
        <label htmlFor={`${id}-${side}-rate`} className="block text-xs">Exchange rate · 1 {from} = {to}</label>
        <QuotationDecimalInput id={`${id}-${side}-rate`} value={rate} precision={8} isValid={value => Number.isFinite(value) && value > 0 && value <= 1e9} disabled={disabled || sameCurrency}
          className="h-10 text-right tabular-nums" blankWhenZero={false} onCommit={changeRate} />
        {sameCurrency ? <p className="text-xs text-muted-foreground">Same currency · no conversion required.</p> :
          <p className="text-xs text-muted-foreground">Edit the rate or converted amount. Original {side} stays unchanged.</p>}
        {custom && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Custom pair: 1 {custom.from} = {custom.rate.toLocaleString("en-US", { maximumFractionDigits: 8 })} {custom.to}</span>
          <button type="button" disabled={disabled} className="min-h-8 text-blue-600 hover:underline disabled:opacity-50" onClick={() => onChange({ [key]: null })}>Use system rate</button>
        </div>}
      </div>;
    })}
  </div>;
}
