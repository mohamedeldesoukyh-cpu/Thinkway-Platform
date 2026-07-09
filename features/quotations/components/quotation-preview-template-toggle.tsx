"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  QUOTATION_TEMPLATE_OPTIONS,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";

type QuotationPreviewTemplateToggleProps = {
  quotationId: string;
  activeTemplate: QuotationTemplateVariant;
  /** When set, links target this path instead of the current pathname. */
  basePath?: string;
};

export function QuotationPreviewTemplateToggle({
  quotationId,
  activeTemplate,
  basePath,
}: QuotationPreviewTemplateToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedBasePath =
    basePath ?? pathname ?? `/discovery/quotations/${quotationId}/preview`;

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Quotation template"
    >
      {QUOTATION_TEMPLATE_OPTIONS.map((option) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        appendQuotationTemplateParam(params, option.id);
        const query = params.toString();
        const href = query ? `${resolvedBasePath}?${query}` : resolvedBasePath;
        const active = activeTemplate === option.id;

        return (
          <Link
            key={option.id}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            <span className="ml-1.5 hidden text-[10px] font-normal text-muted-foreground sm:inline">
              · {option.hint}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
