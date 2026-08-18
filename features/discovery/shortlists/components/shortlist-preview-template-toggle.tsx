"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  appendShortlistTemplateParam,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

type ShortlistPreviewTemplateToggleProps = {
  shortlistId: string;
  activeTemplate: ShortlistTemplateVariant;
  itemIds?: string[];
  basePath?: string;
};

export function ShortlistPreviewTemplateToggle({
  shortlistId,
  activeTemplate,
  itemIds,
  basePath,
}: ShortlistPreviewTemplateToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedBasePath =
    basePath ?? pathname ?? `/discovery/shortlists/${shortlistId}/preview`;

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Shortlist template"
    >
      {SHORTLIST_TEMPLATE_OPTIONS.map((option) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        appendShortlistTemplateParam(params, option.id);
        if (itemIds?.length) {
          params.set("items", itemIds.join(","));
        } else {
          params.delete("items");
        }
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
