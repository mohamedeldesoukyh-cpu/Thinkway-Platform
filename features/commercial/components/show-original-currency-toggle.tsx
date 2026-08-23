"use client";

import { Switch } from "@/components/ui/switch";

import {
  HIDE_COST_AND_FEES_LABEL,
  SHOW_ORIGINAL_CURRENCY_LABEL,
} from "@/lib/commercial/client-original-currency";

function DisplayToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center justify-between gap-3">
      <span className="whitespace-nowrap">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function ClientWorkspaceDisplayToggles({
  showOriginalCurrency,
  hideCostAndFees,
  disabled,
  onShowOriginalCurrencyChange,
  onHideCostAndFeesChange,
}: {
  showOriginalCurrency: boolean;
  hideCostAndFees: boolean;
  disabled?: boolean;
  onShowOriginalCurrencyChange: (next: boolean) => void;
  onHideCostAndFeesChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-w-[220px] flex-col gap-1.5 rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
      <DisplayToggleRow
        label={SHOW_ORIGINAL_CURRENCY_LABEL}
        checked={showOriginalCurrency}
        disabled={disabled}
        onChange={onShowOriginalCurrencyChange}
      />
      <DisplayToggleRow
        label={HIDE_COST_AND_FEES_LABEL}
        checked={hideCostAndFees}
        disabled={disabled}
        onChange={onHideCostAndFeesChange}
      />
    </div>
  );
}
