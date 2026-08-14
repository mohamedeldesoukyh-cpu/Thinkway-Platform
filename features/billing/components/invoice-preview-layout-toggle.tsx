"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { InvoiceDocumentLayout } from "@/lib/billing/invoice-document-layout";

type InvoicePreviewLayoutToggleProps = {
  invoiceId: string;
  activeLayout: InvoiceDocumentLayout;
};

const OPTIONS: Array<{ id: InvoiceDocumentLayout; label: string; hint: string }> = [
  {
    id: "detailed",
    label: "Detailed",
    hint: "Per deliverable",
  },
  {
    id: "by_creator",
    label: "By creator",
    hint: "Line totals",
  },
  {
    id: "package",
    label: "Summary",
    hint: "Lump sum",
  },
];

export function InvoicePreviewLayoutToggle({
  invoiceId,
  activeLayout,
}: InvoicePreviewLayoutToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname ?? `/billing/invoices/${invoiceId}/preview`;

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Invoice layout"
    >
      {OPTIONS.map((option) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("layout", option.id);
        const href = `${basePath}?${params.toString()}`;
        const active = activeLayout === option.id;

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
