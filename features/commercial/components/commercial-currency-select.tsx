"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** Compact inline control for header bands. */
  size?: "default" | "sm";
};

export function CommercialCurrencySelect({
  value,
  onChange,
  disabled,
  label = "Currency",
  className,
  size = "sm",
}: Props) {
  const normalized = (value || "EGP").toUpperCase();

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2",
        size === "sm" ? "text-[11px]" : "text-sm",
        className
      )}
    >
      <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <Select
        value={normalized}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "font-semibold tabular-nums",
            size === "sm" ? "h-7 w-[5.5rem] text-[12px]" : "h-9 w-[6.5rem]"
          )}
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMMERCIAL_CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
