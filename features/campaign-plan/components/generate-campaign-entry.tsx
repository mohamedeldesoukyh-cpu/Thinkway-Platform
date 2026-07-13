"use client";

import { useMemo } from "react";
import { ArrowRightIcon, CheckCircle2Icon, CircleDashedIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { filterExecutionCreatorIds } from "@/lib/domains/commercial/campaign-plan-execution-mapper";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveCampaignNameFromPlan } from "@/lib/domains/commercial/campaign-plan-execution-mapper";

import type { CampaignPlanExecutionContext } from "../actions/generate-campaign-from-plan";

export type GenerateCampaignEntryProps = {
  campaignObject: CampaignObject;
  context: CampaignPlanExecutionContext;
  onGenerate?: () => void;
  className?: string;
  variant?: "default" | "compact";
};

export function GenerateCampaignEntry({
  campaignObject,
  context,
  onGenerate,
  className,
  variant = "default",
}: GenerateCampaignEntryProps) {
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
  ].filter((label): label is string => Boolean(label));

  const missingLabels = [
    !context.brandId ? "Brand (master data)" : null,
    creatorCount === 0 ? "Approved slate creators" : null,
  ].filter((label): label is string => Boolean(label));

  const campaignName = resolveCampaignNameFromPlan(campaignObject);
  const ready = context.canGenerate && missingLabels.length === 0 && !context.existingCampaign;
  const compact = variant === "compact";
  const neededLabels = [
    !context.canGenerate ? "Plan approval" : null,
    ...missingLabels,
  ].filter((label): label is string => Boolean(label));

  const actionClass = compact
    ? "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold"
    : "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold";

  return (
    <div
      className={cn(
        compact ? "p-2.5" : "rounded-xl border border-border bg-background p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {!compact ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Campaign Plan
            </p>
          ) : null}
          <h3
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-xs" : "text-sm font-bold"
            )}
          >
            {compact ? "Execution Campaign" : "Generate Execution Campaign"}
          </h3>
          <p className="truncate text-[10px] text-muted-foreground">
            {campaignName}
            {!compact ? ` · ${context.lifecycleStatus.replaceAll("_", " ")}` : null}
          </p>
        </div>
        {context.existingCampaign ? (
          <a
            href={`/campaigns/${context.existingCampaign.id}`}
            className={cn(
              actionClass,
              "border border-[#1D9E75]/40 bg-[#1D9E75]/5 text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/10"
            )}
          >
            Open {context.existingCampaign.documentNumber}
            <ArrowRightIcon className={compact ? "size-3" : "size-3.5"} />
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
            <ArrowRightIcon className={compact ? "size-3" : "size-3.5"} />
          </button>
        )}
      </div>

      {compact ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-2.5 shrink-0" />
            <span className="text-emerald-700 dark:text-emerald-300">
              {knownLabels.length ? knownLabels.join(" · ") : "Nothing ready"}
            </span>
          </span>
          {neededLabels.length ? (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <CircleDashedIcon className="size-2.5 shrink-0" />
                <span className="text-amber-700 dark:text-amber-300">
                  {neededLabels.join(" · ")}
                </span>
              </span>
            </>
          ) : context.canGenerate && !context.existingCampaign ? (
            <span className="text-muted-foreground">· All set</span>
          ) : null}
        </div>
      ) : (
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
              ) : context.canGenerate && !context.existingCampaign ? (
                <span className="text-[10px] text-muted-foreground">All set</span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!compact && context.existingCampaign ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          An execution campaign already exists for this approved Campaign Plan.
        </p>
      ) : !compact && ready ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Creates a new operational campaign with {creatorCount} vendor line(s) from the approved
          plan snapshot. The quotation, if any, stays independent.
        </p>
      ) : null}
    </div>
  );
}
