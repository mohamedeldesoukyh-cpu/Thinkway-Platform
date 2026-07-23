"use client";

import { AlertCircleIcon } from "lucide-react";

import { formatDateLabel } from "@/features/quotations/quotation-validity";
import { cn } from "@/lib/utils";

type Props = {
  validityDate: string | null;
  validDaysRemaining: number | null;
  isExpired?: boolean;
  className?: string;
  /** Compact pill for the lifecycle band (matches redesign mock). */
  inline?: boolean;
};

export function QuotationValidityBar({
  validityDate,
  validDaysRemaining,
  isExpired,
  className,
  inline = false,
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

  if (inline) {
    return (
      <span
        className={cn("validity", isExpired && "expired", className)}
        title={`Validity ${formatDateLabel(validityDate)}`}
      >
        <AlertCircleIcon aria-hidden />
        Validity {formatDateLabel(validityDate)}
        {daysLabel ? ` · ${daysLabel}` : null}
      </span>
    );
  }

  return (
    <div className={cn("validity", isExpired && "expired", className)}>
      <AlertCircleIcon aria-hidden />
      Validity {formatDateLabel(validityDate)}
      {daysLabel ? ` · ${daysLabel}` : null}
    </div>
  );
}
