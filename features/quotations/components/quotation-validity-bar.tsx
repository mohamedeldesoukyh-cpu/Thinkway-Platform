"use client";

import { AlertCircleIcon } from "lucide-react";

import { formatDateLabel } from "@/features/quotations/quotation-validity";
import { cn } from "@/lib/utils";

type Props = {
  validityDate: string | null;
  validDaysRemaining: number | null;
  isExpired?: boolean;
  className?: string;
};

export function QuotationValidityBar({
  validityDate,
  validDaysRemaining,
  isExpired,
  className,
}: Props) {
  if (!validityDate) return null;

  const daysLabel =
    validDaysRemaining == null
      ? null
      : validDaysRemaining < 0
        ? "Expired"
        : validDaysRemaining === 0
          ? "Expires today"
          : validDaysRemaining === 1
            ? "1 day remaining"
            : `${validDaysRemaining} days remaining`;

  return (
    <div className={cn("thinkway-campaign-po-bar", className)}>
      <AlertCircleIcon className="size-3 shrink-0 text-[var(--camp-amber-text)]" aria-hidden />
      <span className="thinkway-campaign-po-bar-label">Validity:</span>
      <span className="thinkway-campaign-po-bar-val">{formatDateLabel(validityDate)}</span>
      {daysLabel ? (
        <span
          className={cn(
            "thinkway-campaign-po-bar-pct",
            isExpired && "text-[var(--camp-red)]"
          )}
        >
          {daysLabel}
        </span>
      ) : null}
    </div>
  );
}
