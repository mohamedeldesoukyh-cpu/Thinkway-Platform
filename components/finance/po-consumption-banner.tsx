"use client";

import { cn } from "@/lib/utils";
import {
  formatPoBannerCopy,
  PO_BANNER_FRAME,
  resolvePoBannerLevel,
  type PoBannerLevel,
} from "@/lib/finance/po/banner";

type PoConsumptionBannerProps = {
  consumed: number;
  po_amount: number;
  currency: string;
  formatMoney: (amount: number, currency: string) => string;
  po_exceeded?: boolean;
  className?: string;
  compact?: boolean;
};

export function PoConsumptionBanner({
  consumed,
  po_amount,
  currency,
  formatMoney,
  po_exceeded,
  className,
  compact,
}: PoConsumptionBannerProps) {
  const level = resolvePoBannerLevel({ po_amount, consumed, po_exceeded });
  if (!level) return null;

  const copy = formatPoBannerCopy({
    level,
    consumed,
    po_amount,
    currency,
    formatMoney,
  });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl text-sm",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2",
        PO_BANNER_FRAME[level],
        className
      )}
    >
      <span className="font-semibold">{copy.primary}</span>
      <span className="text-muted-foreground">{copy.secondary}</span>
    </div>
  );
}

