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
};

export function GenerateCampaignEntry({
  campaignObject,
  context,
  onGenerate,
  className,
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

  return (
    <div className={cn("rounded-xl border border-border bg-background p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Campaign Plan
          </p>
          <h3 className="text-sm font-bold text-foreground">Generate Execution Campaign</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {campaignName} · {context.lifecycleStatus.replaceAll("_", " ")}
          </p>
        </div>
        {context.existingCampaign ? (
          <a
            href={`/campaigns/${context.existingCampaign.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1D9E75]/40 bg-[#1D9E75]/5 px-3 py-1.5 text-[12px] font-semibold text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/10"
          >
            Open {context.existingCampaign.documentNumber}
            <ArrowRightIcon className="size-3.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!onGenerate || !ready}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#178a66] disabled:opacity-40"
          >
            Generate <ArrowRightIcon className="size-3.5" />
          </button>
        )}
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
            ) : context.canGenerate && !context.existingCampaign ? (
              <span className="text-[10px] text-muted-foreground">All set</span>
            ) : null}
          </div>
        </div>
      </div>

      {context.existingCampaign ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          An execution campaign already exists for this approved Campaign Plan.
        </p>
      ) : ready ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Creates a new operational campaign with {creatorCount} vendor line(s) from the approved
          plan snapshot. The quotation, if any, stays independent.
        </p>
      ) : null}
    </div>
  );
}
