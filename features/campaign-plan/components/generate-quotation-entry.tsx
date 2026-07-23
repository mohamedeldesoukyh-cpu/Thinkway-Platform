"use client";

import { useMemo } from "react";
import { ArrowRightIcon, CheckCircle2Icon, CircleDashedIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { filterExecutionCreatorIds } from "@/lib/domains/commercial/campaign-plan-execution-mapper";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCampaignNameFromPlan } from "@/lib/domains/commercial/campaign-plan-execution-mapper";

import type { CampaignPlanQuotationContext } from "../actions/generate-quotation-from-plan";

export type GenerateQuotationEntryProps = {
  campaignObject: CampaignObject;
  context: CampaignPlanQuotationContext;
  onGenerate?: () => void;
  className?: string;
  variant?: "default" | "compact";
};

export function GenerateQuotationEntry({
  campaignObject,
  context,
  onGenerate,
  className,
  variant = "default",
}: GenerateQuotationEntryProps) {
  const facts = getCampaignFacts(campaignObject);
  const creatorCount = useMemo(
    () => filterExecutionCreatorIds(campaignObject).length,
    [campaignObject]
  );

  const knownLabels = [
    facts?.brandName ? "Brand" : null,
    facts?.budget?.amount ? "Budget" : null,
    creatorCount > 0 ? `${creatorCount} vendor(s)` : null,
    facts?.platforms?.length ? "Platforms" : null,
    facts?.deliverables?.length ? "Deliverables" : null,
  ].filter((label): label is string => Boolean(label));

  const missingLabels = [
    !context.brandId ? "Brand (master data)" : null,
    creatorCount === 0 ? "Approved slate creators" : null,
  ].filter((label): label is string => Boolean(label));

  const campaignName = resolveCampaignNameFromPlan(campaignObject);
  const ready = context.canGenerate && missingLabels.length === 0 && !context.existingQuotation;
  const compact = variant === "compact";
  const neededLabels = [
    !context.canGenerate ? "Plan approval" : null,
    ...missingLabels,
  ].filter((label): label is string => Boolean(label));

  const actionClass = compact
    ? "oc-btn oc-btn-generate"
    : "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold";

  return (
    <div
      className={cn(
        compact ? "flex w-full items-center justify-between gap-4" : "rounded-xl border border-border bg-background p-4",
        className
      )}
    >
      {compact ? (
        <>
          <div className="oc-upnext-left min-w-0 flex-1">
            <h3>Quotation</h3>
            <p>Quality, taste, and value.</p>
            <div className="oc-checklist">
              {knownLabels.map((label) => (
                <span key={label} className="oc-check-tag done">
                  <CheckCircle2Icon aria-hidden />
                  {label}
                </span>
              ))}
              {neededLabels.map((label) => (
                <span key={label} className="oc-check-tag pending">
                  <CircleDashedIcon aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            {context.existingQuotation ? (
              <a
                href={`/discovery/quotations/${encodeURIComponent(context.existingQuotation.serialNumber ?? context.existingQuotation.id)}`}
                className="oc-btn"
              >
                Open {context.existingQuotation.serialNumber ?? "quotation"}
                <ArrowRightIcon aria-hidden />
              </a>
            ) : (
              <button
                type="button"
                onClick={onGenerate}
                disabled={!onGenerate || !ready}
                className={actionClass}
              >
                <ArrowRightIcon aria-hidden />
                Generate
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Campaign Plan
              </p>
              <h3 className="text-sm font-bold text-foreground">Generate Quotation</h3>
              <p className="truncate text-[10px] text-muted-foreground">
                {campaignName} · {context.lifecycleStatus.replaceAll("_", " ")}
              </p>
            </div>
            <div className="shrink-0">
              {context.existingQuotation ? (
                <a
                  href={`/discovery/quotations/${encodeURIComponent(context.existingQuotation.serialNumber ?? context.existingQuotation.id)}`}
                  className={cn(
                    actionClass,
                    "border border-[#1D9E75]/40 bg-[#1D9E75]/5 text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/10"
                  )}
                >
                  Open {context.existingQuotation.serialNumber ?? "quotation"}
                  <ArrowRightIcon className="size-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!onGenerate || !ready}
                  className={cn(
                    actionClass,
                    "bg-[#1D9E75] text-white transition-colors hover:bg-[#178a66] disabled:opacity-40"
                  )}
                >
                  Generate
                  <ArrowRightIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3" /> Ready from plan
            </p>
            <div className="flex flex-wrap gap-1">
              {knownLabels.length ? (
                knownLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-muted-foreground">Nothing yet</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              <CircleDashedIcon className="size-3" /> Still needed
            </p>
            <div className="flex flex-wrap gap-1">
              {!context.canGenerate ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                  Plan approval
                </span>
              ) : null}
              {missingLabels.length ? (
                missingLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
                  >
                    {label}
                  </span>
                ))
              ) : context.canGenerate && !context.existingQuotation ? (
                <span className="text-[10px] text-muted-foreground">All set</span>
              ) : null}
            </div>
          </div>
        </div>
        </>
      )}

      {!compact && context.existingQuotation ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          A quotation already exists for this approved Campaign Plan.
        </p>
      ) : !compact && ready ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Creates a commercial quotation with {creatorCount} creator line(s), deliverables,
          commercials, and tentative posting schedule from the approved plan snapshot.
        </p>
      ) : null}
    </div>
  );
}
