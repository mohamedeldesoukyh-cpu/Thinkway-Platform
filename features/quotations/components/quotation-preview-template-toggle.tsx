"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { quotationPreviewPath } from "@/features/quotations/constants";
import {
  QUOTATION_TEMPLATE_OPTIONS,
  isQuotationListTemplate,
  appendQuotationTemplateParam,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";

type QuotationPreviewTemplateToggleProps = {
  compact?: boolean;
  quotationId: string;
  serialNumber?: string | null;
  activeTemplate: QuotationTemplateVariant;
  /** When set, links target this path instead of the current pathname. */
  basePath?: string;
};

export function QuotationPreviewTemplateToggle({
  compact = false,
  quotationId,
  serialNumber,
  activeTemplate,
  basePath,
}: QuotationPreviewTemplateToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const availableTemplates = searchParams?.get("proposals") ? QUOTATION_TEMPLATE_OPTIONS.filter(option => isQuotationListTemplate(option.id)) : QUOTATION_TEMPLATE_OPTIONS;
  const resolvedBasePath =
    basePath ?? pathname ?? quotationPreviewPath(quotationId, serialNumber);

  if (compact) return (
    <select aria-label="Quotation template" value={activeTemplate}
      className="h-8 w-48 max-w-full rounded-md border border-border bg-background px-2 text-xs font-medium"
      onChange={(event) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        appendQuotationTemplateParam(params, event.target.value as QuotationTemplateVariant);
        router.push(`${resolvedBasePath}${params.size ? `?${params}` : ""}`);
      }}>
      {availableTemplates.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  );

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Quotation template"
    >
      {availableTemplates.map((option) => {
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
