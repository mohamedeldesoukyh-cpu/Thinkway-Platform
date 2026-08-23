"use client";

import { Switch } from "@/components/ui/switch";

import { SHOW_ORIGINAL_CURRENCY_LABEL } from "@/lib/commercial/client-original-currency";

export function ShowOriginalCurrencyToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex h-8 items-center gap-2 rounded-md border border-border/80 bg-background px-2.5 text-[12px] font-medium text-muted-foreground">
      <span className="whitespace-nowrap">{SHOW_ORIGINAL_CURRENCY_LABEL}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={SHOW_ORIGINAL_CURRENCY_LABEL}
      />
    </label>
  );
}
