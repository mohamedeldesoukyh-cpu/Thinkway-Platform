"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { CampaignSeed } from "../hydration/hydration-types";
import type { HydrationField } from "../hydration/hydration-types";
import type { StudioTab } from "../actions/campaign-workspace-message";
import { startCampaignOutputsFromSeed } from "../actions/generate-outputs-action";
import { planGenerateFromSource } from "../hydration/generate-plan";

const HYDRATION_FIELD_LABELS: Record<HydrationField, string> = {
  client: "Client",
  brand: "Brand",
  objective: "Campaign objective",
  audience: "Target audience",
  market: "Market",
  platforms: "Platforms",
  budget: "Budget",
  durationWeeks: "Campaign duration",
  creators: "Creators",
  deliverables: "Deliverables",
  kpis: "KPIs",
};

export type GenerateOutputsLauncherProps = {
  /** The source normalized via the existing seed adapters. */
  seed: CampaignSeed;
  /** If the source already has a Campaign workspace, reuse it (no new campaign). */
  existingConversationId?: string;
  /** Deep-link into a mounted tab (defaults to the Outputs Center). */
  tab?: StudioTab;
  workspace?: { type?: string; id?: string };
  className?: string;
  triggerClassName?: string;
};

/**
 * Compact launcher — primary trigger opens a readiness popover, then navigates
 * to the Campaign workspace through the existing server action.
 */
export function GenerateOutputsLauncher({
  seed,
  existingConversationId,
  tab = "outputs",
  workspace,
  className,
  triggerClassName,
}: GenerateOutputsLauncherProps) {
  const genTrigger = triggerClassName?.includes("gen-trigger");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => {
    if (!seed) {
      return planGenerateFromSource({ source: "quotation", creators: [] });
    }
    return planGenerateFromSource(seed);
  }, [seed]);
  const { known, missingLabels } = plan.result.missing;
  const readyCount = known.length;
  const totalCount = readyCount + missingLabels.length;
  const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const readyLabels = known.map((field) => HYDRATION_FIELD_LABELS[field]);

  const launch = () => {
    startTransition(async () => {
      setError(null);
      const result = await startCampaignOutputsFromSeed({
        seed,
        existingConversationId,
        tab,
        workspace,
      });
      if (result.ok) {
        setOpen(false);
        router.push(result.href);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className={cn(
              !triggerClassName &&
                "inline-flex h-9 items-center gap-2 rounded-[10px] border border-primary bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(0,87,255,0.35),0_6px_16px_-6px_rgba(0,87,255,0.5)] transition-transform hover:bg-[var(--blue-hover,#0048dd)] active:scale-[0.975] disabled:opacity-50",
              triggerClassName
            )}
          >
            <SparklesIcon className="size-3.5" aria-hidden />
            Generate outputs
            <span
              className={cn(
                genTrigger
                  ? "rdy"
                  : "inline-flex h-6 items-center gap-1.5 rounded-[7px] bg-white/18 px-2 text-[11px] font-bold tabular-nums"
              )}
            >
              <span
                className={cn(
                  genTrigger
                    ? "dot"
                    : "size-1.5 rounded-full bg-[#ffd66e] shadow-[0_0_0_3px_rgba(255,214,110,0.25)]"
                )}
              />
              {readyCount}/{totalCount}
            </span>
            <ChevronDownIcon
              className={cn(
                genTrigger ? "car size-3.5 opacity-85 transition-transform" : "size-3.5 opacity-85 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Campaign brief
          </p>
          <h4 className="mt-0.5 text-[14.5px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
            Generate campaign outputs
          </h4>

          <div className="mt-3 h-1.5 overflow-hidden rounded-md bg-muted/50">
            <div
              className="h-full rounded-md bg-gradient-to-r from-[var(--green,#0f9d6b)] to-[#37c98f] transition-[width] duration-200 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            <span className="font-bold text-[var(--text)]">{readyCount}</span> of{" "}
            {totalCount} inputs ready
          </p>

          <div className="mt-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--green-text)]">
              <CheckCircle2Icon className="size-3" />
              Ready
            </p>
            <div className="flex flex-wrap gap-1.5">
              {readyLabels.length ? (
                readyLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--green-bg)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--green-text)]"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-[var(--text-3)]">Nothing yet</span>
              )}
            </div>
          </div>

          <div className="mt-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--amber-text)]">
              <CircleDashedIcon className="size-3" />
              Still needed
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missingLabels.length ? (
                missingLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--amber-bg)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--amber-text)]"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-[var(--text-3)]">All set</span>
              )}
            </div>
          </div>

          <Button
            type="button"
            className="mt-4 h-[38px] w-full gap-2 rounded-[10px] text-[13px] font-semibold shadow-[0_6px_16px_-6px_rgba(0,87,255,0.5)] active:scale-[0.98]"
            onClick={launch}
            disabled={pending}
          >
            {pending ? "Opening…" : "Generate outputs"}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </PopoverContent>
      </Popover>

      {error ? <p className="text-[10px] text-red-500">{error}</p> : null}
    </div>
  );
}
