"use client";

import { QuotationSortHeaderIndicator } from "@/features/quotations/components/quotation-sort-header-indicator";
import {
  applyQuotationCommercialSummaryHeaderSort,
  type QuotationCommercialSummarySortField,
  type QuotationCommercialSummarySortState,
} from "@/lib/quotations/quotation-commercial-summary-sort";
import { cn } from "@/lib/utils";

const CS = {
  muted: "#9a988f",
  line: "#e8e6dc",
} as const;

export function QuotationCommercialSummarySortableHead({
  label,
  field,
  align = "left",
  sort,
  onSortChange,
}: {
  label: string;
  field: QuotationCommercialSummarySortField;
  align?: "left" | "right";
  sort: QuotationCommercialSummarySortState | null;
  onSortChange: (next: QuotationCommercialSummarySortState) => void;
}) {
  const isActive = sort?.field === field;

  return (
    <th
      className={cn(
        "pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em]",
        align === "right" ? "px-1.5 text-right" : "pl-0 pr-1.5 text-left"
      )}
      style={{ color: CS.muted, borderBottom: `0.5px solid ${CS.line}` }}
    >
      <button
        type="button"
        onClick={() =>
          onSortChange(applyQuotationCommercialSummaryHeaderSort(sort, field))
        }
        aria-sort={isActive ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
        aria-label={
          isActive
            ? `Sort by ${label}, ${sort!.direction === "asc" ? "ascending" : "descending"}`
            : `Sort by ${label}`
        }
        className={cn(
          "inline-flex w-full min-w-0 items-center gap-0.5 transition-colors hover:opacity-80",
          align === "right" && "justify-end text-right"
        )}
        style={{ color: isActive ? "#141413" : CS.muted }}
      >
        <span className="truncate">{label}</span>
        <QuotationSortHeaderIndicator
          direction={isActive ? sort!.direction : null}
          inactiveClassName="opacity-70"
        />
      </button>
    </th>
  );
}
