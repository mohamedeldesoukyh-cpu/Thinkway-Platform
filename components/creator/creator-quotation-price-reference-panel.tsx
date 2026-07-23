"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { platformLabel } from "@/lib/campaigns/line-assignment";
import type {
  CreatorQuotationPriceReference,
  CreatorQuotationPriceSegment,
} from "@/lib/creators/quotation-price-reference";
import {
  formatQuotationPriceSegmentHeadline,
} from "@/lib/creators/quotation-price-reference";
import { formatMoney } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

type Props = {
  reference: CreatorQuotationPriceReference | null;
  className?: string;
  compact?: boolean;
  loading?: boolean;
};

function quotePricingLabel(pricingKind: "package" | "platform", platform: string | null): string {
  if (pricingKind === "package") return "Package";
  if (platform) return platformLabel(platform);
  return "Quoted line";
}

function QuotationPriceSegmentLine({
  segment,
  emphasize = false,
}: {
  segment: CreatorQuotationPriceSegment;
  emphasize?: boolean;
}) {
  return (
    <div className={cn(emphasize ? "space-y-1" : "space-y-0.5")}>
      <p
        className={cn(
          "font-semibold tabular-nums text-[#1D9E75]",
          emphasize ? "text-lg" : "text-sm"
        )}
      >
        {formatQuotationPriceSegmentHeadline(segment)}
      </p>
      <p className="text-xs text-muted-foreground">
        Average creator cost across {segment.quote_count} quotation
        {segment.quote_count === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

function QuotationPriceSummary({ reference }: { reference: CreatorQuotationPriceReference }) {
  const packageSegment = reference.segments.find((segment) => segment.kind === "package") ?? null;
  const platformSegments = reference.segments.filter((segment) => segment.kind === "platform");
  const splitLayout = Boolean(packageSegment && platformSegments.length > 0);

  if (splitLayout && packageSegment) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Package
          </p>
          <QuotationPriceSegmentLine segment={packageSegment} emphasize />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Per platform
          </p>
          <div className="space-y-3">
            {platformSegments.map((segment) => (
              <QuotationPriceSegmentLine
                key={segment.platform ?? "unknown"}
                segment={segment}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (reference.segments.length === 1) {
    return <QuotationPriceSegmentLine segment={reference.segments[0]!} emphasize />;
  }

  if (platformSegments.length > 1 && !packageSegment) {
    return (
      <div className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Per platform
        </p>
        {platformSegments.map((segment) => (
          <QuotationPriceSegmentLine key={segment.platform ?? "unknown"} segment={segment} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reference.segments.map((segment) => (
        <QuotationPriceSegmentLine
          key={segment.kind === "package" ? "package" : segment.platform ?? "unknown"}
          segment={segment}
        />
      ))}
    </div>
  );
}

export function CreatorQuotationPriceReferencePanel({
  reference,
  className,
  compact = false,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground",
          className
        )}
      >
        Loading quotation reference…
      </div>
    );
  }

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

  const packageSegment = reference.segments.find((segment) => segment.kind === "package") ?? null;
  const platformSegments = reference.segments.filter((segment) => segment.kind === "platform");
  const splitLayout = Boolean(packageSegment && platformSegments.length > 0);
  const singleSegment = reference.segments.length === 1 ? reference.segments[0]! : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-[#1D9E75]/25 bg-[#1D9E75]/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Quotation price reference
            </p>
            <div className="mt-2">
              {!splitLayout && singleSegment ? (
                <QuotationPriceSegmentLine segment={singleSegment} emphasize />
              ) : (
                <QuotationPriceSummary reference={reference} />
              )}
            </div>
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
                      href={`/discovery/quotations/${encodeURIComponent(quote.quotation_serial ?? quote.quotation_id)}`}
                      className="truncate font-medium hover:text-[#1D9E75]"
                    >
                      {quote.quotation_serial ?? quote.quotation_name ?? "Quotation"}
                    </Link>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                      {quotePricingLabel(quote.pricing_kind, quote.platform)}
                    </Badge>
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
