"use client";

import { Layers2Icon } from "lucide-react";

import { collapseContentPreviewLabel } from "@/lib/discovery/collapse-content";
import { optionNumberLabel } from "@/lib/quotations/quotation-deliverable-types";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  creatorCount: number;
  optionNumber?: number;
  isFirstGroup: boolean;
};

/** Collapse content bundle header above grouped creator lines in quotation workspace. */
export function QuotationCollapseContentHeaderRow({
  label,
  creatorCount,
  optionNumber,
  isFirstGroup,
}: Props) {
  const optionLabel =
    optionNumber != null && optionNumber > 0 ? optionNumberLabel(optionNumber) : null;

  return (
    <div
      data-collapse-content-header
      className={cn(
        "collapse-content-header border-b border-primary/20 bg-primary/[0.08] px-[var(--gut,32px)] py-2.5",
        isFirstGroup && "border-t-2 border-transparent"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary">
            <Layers2Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {collapseContentPreviewLabel(label)} · {creatorCount} creators
              {optionLabel ? ` · ${optionLabel}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
