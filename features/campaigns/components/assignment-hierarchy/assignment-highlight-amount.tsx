import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AssignmentHighlightAmountProps = {
  variant: "rev" | "cost" | "billing";
  children: ReactNode;
  className?: string;
};

const VARIANT_CLASS = {
  rev: "thinkway-campaign-cell-highlight-rev thinkway-campaign-cell-rev",
  cost: "thinkway-campaign-cell-highlight-cost thinkway-campaign-cell-cost",
  billing: "thinkway-campaign-cell-highlight-billing thinkway-campaign-cell-billing-total",
} as const;

/** Parent row financial emphasis — matches HTML cell-rev / cell-cost / cell-billing-total pills. */
export function AssignmentHighlightAmount({
  variant,
  children,
  className,
}: AssignmentHighlightAmountProps) {
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 tabular-nums", VARIANT_CLASS[variant], className)}>
      {children}
    </span>
  );
}
