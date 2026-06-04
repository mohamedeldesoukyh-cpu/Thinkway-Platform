"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeVatLine } from "@/lib/vat/calculations";
import { formatBillingMoney } from "@/features/billing/utils";

type VatAmountSectionProps = {
  title: string;
  amountLabel: string;
  beforeVat: number;
  vatPercent: number;
  exempt: boolean;
  currency: string;
  disabled?: boolean;
  /** When true, amount is read-only (e.g. FX-derived cost in LC). */
  amountDisabled?: boolean;
  onBeforeVatChange: (value: number) => void;
  onVatPercentChange: (value: number) => void;
  onExemptChange: (value: boolean) => void;
  badge?: React.ReactNode;
};

export function VatAmountSection({
  title,
  amountLabel,
  beforeVat,
  vatPercent,
  exempt,
  currency,
  disabled,
  amountDisabled,
  onBeforeVatChange,
  onVatPercentChange,
  onExemptChange,
  badge,
}: VatAmountSectionProps) {
  const computed = useMemo(
    () =>
      computeVatLine({
        beforeVat,
        vatPercent,
        exempt,
      }),
    [beforeVat, vatPercent, exempt]
  );

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {badge}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{amountLabel}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={beforeVat}
            onChange={(e) => onBeforeVatChange(Number(e.target.value))}
            disabled={disabled || amountDisabled}
          />
        </div>
        <div className="grid gap-2">
          <Label>VAT %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.001"
            value={exempt ? 0 : vatPercent}
            onChange={(e) => onVatPercentChange(Number(e.target.value))}
            disabled={disabled || exempt}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={exempt}
          onChange={(e) => onExemptChange(e.target.checked)}
          disabled={disabled}
          className="size-4 rounded border border-input"
        />
        VAT exempt
      </label>
      <div className="grid gap-1 rounded-xl bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Before VAT</span>
          <span>{formatBillingMoney(computed.beforeVat, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">VAT ({computed.vatPercent}%)</span>
          <span>{formatBillingMoney(computed.vatAmount, currency)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>After VAT</span>
          <span>{formatBillingMoney(computed.afterVat, currency)}</span>
        </div>
      </div>
    </div>
  );
}
