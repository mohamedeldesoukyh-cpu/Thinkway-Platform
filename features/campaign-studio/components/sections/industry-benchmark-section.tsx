"use client";

import { cn } from "@/lib/utils";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingBadge } from "./shared/grounding-badge";
import { resolveIndustryBenchmark } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type IndustryBenchmarkSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function IndustryBenchmarkSection({
  campaignObject,
  fallbackText,
  status,
}: IndustryBenchmarkSectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const benchmark = resolveIndustryBenchmark(campaignObject);
  if (!benchmark) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Industry benchmarks pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        {benchmark.comparisons.map((row) => (
          <div
            key={row.metric}
            className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 break-words text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {row.metric}
              </p>
              <GroundingBadge source={row.source} />
            </div>
            <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-2 text-[11px]">
              <div className="min-w-0">
                <span className="text-muted-foreground">Expected</span>
                <p className="break-words font-bold text-[#1D9E75]">{row.expected}</p>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground">Industry</span>
                <p className="break-words font-semibold">{row.industry}</p>
              </div>
            </div>
            <p className="mt-1 break-words text-[9px] text-violet-600">{row.variance}</p>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-1.5 rounded-lg border border-[#1D9E75]/30 bg-[#1D9E75]/5 p-2.5 text-[11px]">
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Est. CPM</span>
          <span className="break-words text-right font-semibold">{benchmark.estCpm}</span>
        </div>
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Est. CPC/CPE</span>
          <span className="break-words text-right font-semibold">{benchmark.estCpc}</span>
        </div>
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Est. Reach</span>
          <span className="break-words text-right font-semibold">{benchmark.estReach}</span>
        </div>
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Posting Frequency</span>
          <span className="break-words text-right font-semibold">{benchmark.postingFrequency}</span>
        </div>
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Creator Mix</span>
          <span className="break-words text-right font-semibold">{benchmark.creatorMixBenchmark}</span>
        </div>
        <div className="flex min-w-0 justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Budget Efficiency</span>
          <span className="break-words text-right font-semibold">{benchmark.budgetEfficiency}</span>
        </div>
      </div>
    </div>
  );
}
