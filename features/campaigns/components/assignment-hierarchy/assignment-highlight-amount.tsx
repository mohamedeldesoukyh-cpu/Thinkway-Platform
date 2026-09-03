import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AssignmentHighlightAmountProps = {
  variant: "rev" | "cost" | "billing";
  children: ReactNode;
  className?: string;
};

const VARIANT_CLASS = {
  rev: "thinkway-campaign-cell-rev",
  cost: "thinkway-campaign-cell-cost",
  billing: "thinkway-campaign-cell-billing-total",
} as const;

/**
 * Parent-row money emphasis — plain mono values (design mock `.tw-v`).
 * Tint chips are edit-mode only; resting rows stay ink on white.
 */
export function AssignmentHighlightAmount({
  variant,
  children,
  className,
}: AssignmentHighlightAmountProps) {
  return (
    <span className={cn("tabular-nums", VARIANT_CLASS[variant], className)}>
      {children}
    </span>
  );
}
