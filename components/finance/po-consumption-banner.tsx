"use client";

import { cn } from "@/lib/utils";
import {
  formatPoBannerCopy,
  PO_BANNER_FRAME,
  PO_BANNER_TEXT,
  resolvePoBannerLevel,
} from "@/lib/finance/po/banner";

type PoConsumptionBannerProps = {
  consumed: number;
  po_amount: number;
  currency: string;
  formatMoney: (amount: number, currency: string) => string;
  po_exceeded?: boolean;
  className?: string;
  compact?: boolean;
  variant?: "banner" | "inline" | "po-bar";
};

export function PoConsumptionBanner({
  consumed,
  po_amount,
  currency,
  formatMoney,
  po_exceeded,
  className,
  compact,
  variant = "banner",
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

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "text-right text-sm tabular-nums",
          compact && "text-xs",
          PO_BANNER_TEXT[level],
          className
        )}
      >
        <span className="font-medium">{copy.primary}</span>{" "}
        <span className="opacity-75">{copy.secondary}</span>
      </p>
    );
  }

  if (variant === "po-bar") {
    const pct = po_amount > 0 ? Math.round((Math.max(consumed, 0) / po_amount) * 100) : 0;
    return (
      <div className={cn("thinkway-campaign-po-bar", className)} role="status">
        <svg
          width="12"
          height="12"
          fill="none"
          stroke="#b45309"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="thinkway-campaign-po-bar-label">PO consumed:</span>
        <span className="thinkway-campaign-po-bar-val tabular-nums">
          {formatMoney(consumed, currency)} of {formatMoney(po_amount, currency)}
        </span>
        <span className="thinkway-campaign-po-bar-pct tabular-nums">{pct}% consumed</span>
      </div>
    );
  }

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

