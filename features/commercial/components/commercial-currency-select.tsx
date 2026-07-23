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
  /** Short label shown above/beside the control. Use "CCY" in cramped headers. */
  label?: string | null;
  className?: string;
  /** Compact inline control for header bands. */
  size?: "default" | "sm";
  /**
   * `metric` matches quotation metrics-band layout (label on top, control below).
   * `inline` keeps label + select on one row.
   */
  layout?: "inline" | "metric";
};

export function CommercialCurrencySelect({
  value,
  onChange,
  disabled,
  label = "CCY",
  className,
  size = "sm",
  layout = "inline",
}: Props) {
  const normalized = (value || "EGP").toUpperCase();
  const showLabel = Boolean(label);

  const select = (
    <Select value={normalized} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "font-semibold tabular-nums",
          size === "sm" ? "h-7 w-[4.25rem] px-2 text-[12px]" : "h-9 w-[5.5rem]",
          layout === "metric" && "mt-0.5 w-full max-w-[4.5rem]"
        )}
        aria-label={label || "Currency"}
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
  );

  if (layout === "metric") {
    return (
      <div className={cn("min-w-0", className)}>
        {showLabel ? <div className="l">{label}</div> : null}
        {select}
      </div>
    );
  }

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5",
        size === "sm" ? "text-[11px]" : "text-sm",
        className
      )}
    >
      {showLabel ? (
        <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      ) : null}
      {select}
    </label>
  );
}
