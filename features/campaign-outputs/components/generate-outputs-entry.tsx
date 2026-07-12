"use client";

import { useMemo } from "react";
import { ArrowRightIcon, CheckCircle2Icon, CircleDashedIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";

import { getOutputDefinition } from "../output-catalog";
import type { CampaignSeed } from "../hydration/hydration-types";
import { planGenerateFromSource } from "../hydration/generate-plan";

const SOURCE_LABELS: Record<CampaignSeed["source"], string> = {
  campaign_brief: "Campaign Brief",
  creator_shortlist: "Creator Shortlist",
  quotation: "Quotation",
  discovery_selection: "Discovery Selection",
  existing_campaign: "Existing Campaign",
  crm_campaign: "CRM Campaign",
  manual_wizard: "Manual Campaign",
};

export type GenerateOutputsEntryProps = {
  /** The source, already normalized into a seed via the shared adapters. */
  seed: CampaignSeed;
  /** Existing Campaign Object to hydrate into (gaps only), when one exists. */
  existing?: CampaignObject;
  /**
   * Called with the hydrated Campaign Object when the user starts generation.
   * The host wires this to its existing "create conversation + persist campaign
   * object + open the Outputs Center" flow — no output logic lives here.
   */
  onGenerate?: (campaignObject: CampaignObject) => void;
  className?: string;
};

/**
 * A drop-in "Generate Campaign Outputs" entry for any source page (Quotation,
 * Shortlist, Discovery, …). It hydrates the source into the Campaign Object,
 * shows what's already known vs still missing, and lists the outputs that are
 * ready — then hands the hydrated Campaign Object to the host. It reuses Smart
 * Hydration and the Output Registry; it duplicates neither.
 */
export function GenerateOutputsEntry({ seed, existing, onGenerate, className }: GenerateOutputsEntryProps) {
  const plan = useMemo(() => planGenerateFromSource(seed, existing), [seed, existing]);
  const { missing } = plan.result;
  const knownLabels = missing.known.map((f) => f);

  return (
    <div className={cn("rounded-xl border border-border bg-background p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {SOURCE_LABELS[seed.source]}
          </p>
          <h3 className="text-sm font-bold text-foreground">Generate Campaign Outputs</h3>
        </div>
        <button
          type="button"
          onClick={() => onGenerate?.(plan.result.campaignObject)}
          disabled={!onGenerate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#178a66] disabled:opacity-40"
        >
          Generate <ArrowRightIcon className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-3" /> Already known
          </p>
          <div className="flex flex-wrap gap-1">
            {knownLabels.length ? (
              knownLabels.map((f) => (
                <span key={f} className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                  {f}
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
            {missing.missingLabels.length ? (
              missing.missingLabels.map((f) => (
                <span key={f} className="rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                  {f}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground">All set</span>
            )}
          </div>
        </div>
      </div>

      {plan.readyKinds.length ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Ready to generate now: {plan.readyKinds.map((k) => getOutputDefinition(k)?.label ?? k).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
