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
import { resolveExchangeRateAction } from "@/features/finance/exchange-rates/resolve-rate-action";
import { convertAmount, formatFxRate } from "@/lib/finance/fx/conversion";
import { formatMoney } from "@/features/campaigns/utils";

type AssignmentMultiCurrencyCostFieldsProps = {
  campaignCurrency: string;
  costReceived: number;
  costReceivedCurrency: string;
  costInLc: number;
  currencyOptions: { value: string; label: string }[];
  disabled?: boolean;
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
    if (sameCurrency) return "Same as campaign currency — no conversion.";
    if (resolving) return "Resolving exchange rate…";
    if (fxError) return fxError;
    return `1 ${costReceivedCurrency} = ${formatFxRate(fxRate)} ${campaignCurrency}`;
  }, [sameCurrency, resolving, fxError, costReceivedCurrency, fxRate, campaignCurrency]);

  return (
    <div className="grid gap-3 rounded-2xl border bg-muted/15 p-3">
      <p className="text-sm font-medium">Creator cost (multi-currency)</p>
      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="grid gap-2">
          <Label>Cost currency</Label>
          <Select
            value={costReceivedCurrency}
            onValueChange={onCostReceivedCurrencyChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Cost in LC</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 font-mono text-sm">
            {formatMoney(costInLc, campaignCurrency)}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{fxHint}</p>
      <input type="hidden" name="cost_received" value={costReceived} />
      <input type="hidden" name="cost_received_currency" value={costReceivedCurrency} />
      <input type="hidden" name="fx_rate" value={fxRate} />
      <input type="hidden" name="fx_from_currency" value={costReceivedCurrency} />
      <input type="hidden" name="fx_to_currency" value={campaignCurrency} />
    </div>
  );
}
