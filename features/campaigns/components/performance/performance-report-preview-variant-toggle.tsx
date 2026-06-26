"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { PerformanceReportVariant } from "@/lib/performance/report";

type PerformanceReportPreviewVariantToggleProps = {
  campaignId: string;
  activeVariant: PerformanceReportVariant;
};

const OPTIONS: Array<{ id: PerformanceReportVariant; label: string; hint: string }> = [
  { id: "combined", label: "Combined", hint: "Full campaign" },
  { id: "influencers", label: "Influencer", hint: "Per creator" },
];

export function PerformanceReportPreviewVariantToggle({
  campaignId,
  activeVariant,
}: PerformanceReportPreviewVariantToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname ?? `/campaigns/${campaignId}/performance/preview`;

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Report variant"
    >
      {OPTIONS.map((option) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (option.id === "combined") {
          params.delete("variant");
        } else {
          params.set("variant", option.id);
        }
        const query = params.toString();
        const href = query ? `${basePath}?${query}` : basePath;
        const active = activeVariant === option.id;

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
