"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DETAIL_SHEET_SELECT_CONTENT_PROPS } from "@/features/campaigns/components/operational-detail-panel";
import { formatBillingMoney } from "@/features/billing/utils";
import { resolveExchangeRateAction } from "@/features/finance/exchange-rates/resolve-rate-action";
import { convertAmount, formatFxRate } from "@/lib/finance/fx/conversion";

type AssignmentMultiCurrencyCostFieldsProps = {
  campaignCurrency: string;
  costReceived: number;
  costReceivedCurrency: string;
  costInLc: number;
  currencyOptions: { value: string; label: string }[];
  disabled?: boolean;
  lockHint?: string | null;
  onCostReceivedChange: (value: number) => void;
  onCostReceivedCurrencyChange: (code: string) => void;
  onCostInLcChange: (value: number) => void;
  onFxRateChange: (rate: number) => void;
};

export function AssignmentMultiCurrencyCostFields({
  campaignCurrency,
  costReceived,
  costReceivedCurrency,
  costInLc,
  currencyOptions,
  disabled,
  lockHint,
  onCostReceivedChange,
  onCostReceivedCurrencyChange,
  onCostInLcChange,
  onFxRateChange,
}: AssignmentMultiCurrencyCostFieldsProps) {
  const [fxRate, setFxRate] = useState(1);
  const [fxError, setFxError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const sameCurrency =
    costReceivedCurrency.toUpperCase() === campaignCurrency.toUpperCase();

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (sameCurrency) {
        setFxRate(1);
        setFxError(null);
        onFxRateChange(1);
        const lc = convertAmount({ amount: costReceived, exchange_rate: 1 });
        onCostInLcChange(lc);
        return;
      }

      setResolving(true);
      setFxError(null);
      const result = await resolveExchangeRateAction({
        from_currency: costReceivedCurrency,
        to_currency: campaignCurrency,
      });
      if (cancelled) return;

      setResolving(false);
      if (!result.ok || result.rate == null) {
        setFxError(result.message ?? "Exchange rate unavailable.");
        return;
      }

      setFxRate(result.rate);
      onFxRateChange(result.rate);
      const lc = convertAmount({ amount: costReceived, exchange_rate: result.rate });
      onCostInLcChange(lc);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- LC sync driven by amount/currency only
  }, [costReceived, costReceivedCurrency, campaignCurrency, sameCurrency]);

  const fxHint = useMemo(() => {
    if (sameCurrency) return "Same as assignment currency — no conversion.";
    if (resolving) return "Resolving exchange rate…";
    if (fxError) return fxError;
    return `1 ${costReceivedCurrency} = ${formatFxRate(fxRate)} ${campaignCurrency}`;
  }, [sameCurrency, resolving, fxError, costReceivedCurrency, fxRate, campaignCurrency]);

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Creator cost (multi-currency)</p>
      </div>
      {disabled && lockHint ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">{lockHint}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="cost_received">Cost received</Label>
          <Input
            id="cost_received"
            type="number"
            min={0}
            step="0.01"
            value={Number.isFinite(costReceived) ? costReceived : 0}
            onChange={(e) => onCostReceivedChange(Number(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label>Cost currency</Label>
          <Select
            modal={false}
            value={costReceivedCurrency}
            onValueChange={onCostReceivedCurrencyChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...DETAIL_SHEET_SELECT_CONTENT_PROPS}>
              {currencyOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{fxHint}</p>
      <div className="grid gap-1 rounded-xl bg-muted/40 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">Cost in LC</span>
          <span className="truncate text-right font-medium tabular-nums">
            {formatBillingMoney(costInLc, campaignCurrency)}
          </span>
        </div>
      </div>
      <input type="hidden" name="cost_received" value={costReceived} />
      <input type="hidden" name="cost_received_currency" value={costReceivedCurrency} />
      <input type="hidden" name="fx_rate" value={fxRate} />
      <input type="hidden" name="fx_from_currency" value={costReceivedCurrency} />
      <input type="hidden" name="fx_to_currency" value={campaignCurrency} />
    </div>
  );
}
