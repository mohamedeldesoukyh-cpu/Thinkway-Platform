"use client";

import { QuotationSortHeaderIndicator } from "@/features/quotations/components/quotation-sort-header-indicator";
import { TableHead } from "@/components/ui/table";
import {
  applyQuotationWorkspaceHeaderSort,
  type QuotationWorkspaceSortField,
  type QuotationWorkspaceSortState,
} from "@/lib/quotations/quotation-workspace-sort";
import { cn } from "@/lib/utils";

export function QuotationWorkspaceSortableHead({
  label,
  subLabel,
  field,
  align,
  sort,
  onSortChange,
  className,
  variant = "table",
  columnClassName,
}: {
  label: string;
  subLabel?: string;
  field: QuotationWorkspaceSortField;
  align?: "left" | "right" | "center";
  sort: QuotationWorkspaceSortState | null;
  onSortChange: (next: QuotationWorkspaceSortState) => void;
  className?: string;
  variant?: "table" | "flex";
  columnClassName?: string;
}) {
  const isActive = sort?.field === field;

  const button = (
    <button
      type="button"
      onClick={() => onSortChange(applyQuotationWorkspaceHeaderSort(sort, field))}
      aria-sort={isActive ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
      aria-label={
        isActive
          ? `Sort by ${label}, ${sort!.direction === "asc" ? "ascending" : "descending"}`
          : `Sort by ${label}`
      }
      className={cn(
        "inline-flex w-full min-w-0 gap-0.5 transition-colors hover:text-[var(--text)]",
        subLabel ? "flex-col items-end" : "items-center",
        !subLabel && align === "right" && "justify-end text-right",
        !subLabel && align === "center" && "justify-center text-center",
        isActive && "text-[var(--text)]"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-0.5",
          subLabel && "w-full justify-end",
          align === "center" && !subLabel && "justify-center"
        )}
      >
        <span className={cn(subLabel ? "text-xs font-bold uppercase tracking-wide" : "truncate")}>
          {label}
        </span>
        <QuotationSortHeaderIndicator direction={isActive ? sort!.direction : null} />
      </span>
      {subLabel ? (
        <span className="text-[10px] font-normal normal-case text-[var(--text-4)]">{subLabel}</span>
      ) : null}
    </button>
  );

  if (variant === "flex") {
    return (
      <span
        className={cn(
          columnClassName,
          align === "right" && "text-right",
          align === "center" && "text-center",
          className
        )}
      >
        {button}
      </span>
    );
  }

  return (
    <TableHead
      className={cn(
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {button}
    </TableHead>
  );
}
