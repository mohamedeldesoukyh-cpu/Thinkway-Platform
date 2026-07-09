"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  CreatorQuotationPriceReference,
} from "@/lib/creators/quotation-price-reference";
import { formatQuotationPriceReferenceLabel } from "@/lib/creators/quotation-price-reference";
import { formatMoney } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

type Props = {
  reference: CreatorQuotationPriceReference | null;
  className?: string;
  compact?: boolean;
};

export function CreatorQuotationPriceReferencePanel({
  reference,
  className,
  compact = false,
}: Props) {
  if (!reference || reference.quote_count === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground",
          className
        )}
      >
        No quotation prices recorded yet. Costs entered on quotations will appear here as a
        reference average for studio and selection.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-[#1D9E75]/25 bg-[#1D9E75]/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Quotation price reference
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#1D9E75]">
              {formatQuotationPriceReferenceLabel(reference)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Average creator cost across {reference.quote_count} quotation
              {reference.quote_count === 1 ? "" : "s"}.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Studio reference
          </Badge>
        </div>
      </div>

      {!compact && reference.recent_quotes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent quotation lines
          </p>
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {reference.recent_quotes.map((quote) => (
              <li
                key={`${quote.quotation_id}-${quote.quoted_at}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/discovery/quotations/${quote.quotation_id}`}
                      className="truncate font-medium hover:text-[#1D9E75]"
                    >
                      {quote.quotation_serial ?? quote.quotation_name ?? "Quotation"}
                    </Link>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {quote.deliverable_summary}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(quote.cost, quote.cost_currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
