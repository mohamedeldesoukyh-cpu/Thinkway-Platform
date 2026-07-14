"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type QuotationSortDirection = "asc" | "desc" | null;

export function QuotationSortHeaderIndicator({
  direction,
  className,
  inactiveClassName,
}: {
  direction: QuotationSortDirection;
  className?: string;
  /** Applied when unsorted; defaults to muted dual chevrons */
  inactiveClassName?: string;
}) {
  const iconClass = cn("size-3 shrink-0", className);

  if (direction === "asc") {
    return <ArrowUpIcon className={iconClass} aria-hidden />;
  }

  if (direction === "desc") {
    return <ArrowDownIcon className={iconClass} aria-hidden />;
  }

  return (
    <ChevronsUpDownIcon
      className={cn(iconClass, inactiveClassName ?? "text-muted-foreground/50")}
      aria-hidden
    />
  );
}
