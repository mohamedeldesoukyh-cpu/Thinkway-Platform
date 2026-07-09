"use client";

import { AlertTriangleIcon, CheckCircle2Icon, WrenchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { ExtractionIssue } from "../services/normalization/types";
import type { DiscoveryCampaignRequirements } from "../services/discovery-campaign-requirements";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ExtractionIssue[];
  requirements: DiscoveryCampaignRequirements;
  onFixField?: (field: string) => void;
};

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    brandName: "Brand",
    "brand.brandName": "Brand",
    market: "Market",
    "market.countryCode": "Market",
    platforms: "Platforms",
    "audienceDetail.gender": "Audience gender",
    "audience.gender": "Audience gender",
    "audienceDetail.countries": "Audience countries",
    "audience.countries": "Audience countries",
    creatorCategories: "Creator categories",
    creatorNiches: "Creator niches",
    keywords: "Keywords",
  };
  return labels[field] ?? field;
}

function correctedValue(
  field: string,
  requirements: DiscoveryCampaignRequirements
): string | null {
  if (field === "brandName" || field === "brand.brandName") {
    return requirements.brandName || null;
  }
  if (field === "market" || field === "market.countryCode") {
    return requirements.marketCountry || null;
  }
  if (field === "platforms") {
    return requirements.platforms.length ? requirements.platforms.join(", ") : null;
  }
  if (field.includes("gender")) {
    return requirements.audienceGender || null;
  }
  if (field.includes("countries")) {
    return requirements.audienceCountries.length
      ? requirements.audienceCountries.join(", ")
      : null;
  }
  if (field === "creatorCategories") {
    return requirements.categories.length ? requirements.categories.join(", ") : null;
  }
  return null;
}

export function ExtractionReviewPanel({
  open,
  onOpenChange,
  issues,
  requirements,
  onFixField,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(480px,92vw)] max-w-[480px] flex-col gap-0 p-0 sm:max-w-[480px]"
      >
        <SheetTitle className="sr-only">Extraction review</SheetTitle>
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-600" />
            <h2 className="font-heading text-lg font-semibold">Extraction review</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Values rejected or needing confirmation. Fix in campaign requirements or re-upload the
            brief.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2Icon className="size-8 text-[#1D9E75]" />
              <p className="text-sm text-muted-foreground">No extraction issues.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {issues.map((issue, index) => {
                const corrected = correctedValue(issue.field, requirements);
                return (
                  <li
                    key={`${issue.field}-${index}`}
                    className="rounded-lg border border-border/80 bg-muted/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {fieldLabel(issue.field)}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          issue.severity === "error"
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                            : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                        )}
                      >
                        {issue.kind?.replace(/_/g, " ") ?? issue.severity}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div>
                        <dt className="font-medium text-muted-foreground">Original</dt>
                        <dd className="mt-0.5 font-mono text-foreground">&ldquo;{issue.rawValue}&rdquo;</dd>
                      </div>
                      {corrected ? (
                        <div>
                          <dt className="font-medium text-muted-foreground">Corrected</dt>
                          <dd className="mt-0.5 text-foreground">{corrected}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="font-medium text-muted-foreground">Corrected</dt>
                          <dd className="mt-0.5 italic text-muted-foreground">Needs confirmation</dd>
                        </div>
                      )}
                      <div>
                        <dt className="font-medium text-muted-foreground">Reason</dt>
                        <dd className="mt-0.5 text-foreground">{issue.reason}</dd>
                      </div>
                    </dl>
                    {onFixField ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 gap-1.5 text-xs"
                        onClick={() => onFixField(issue.field)}
                      >
                        <WrenchIcon className="size-3.5" />
                        Fix
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
