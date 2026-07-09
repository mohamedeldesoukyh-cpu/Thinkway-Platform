"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingFooter } from "./shared/grounding-badge";
import { resolveSuccessProbability } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type SuccessProbabilitySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function ListBlock({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <p className={cn("text-[10px] font-bold tracking-wide uppercase", color)}>{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] text-foreground">· {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SuccessProbabilitySection({
  campaignObject,
  fallbackText,
  status,
}: SuccessProbabilitySectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveSuccessProbability(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Success probability pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-violet-300/40 bg-gradient-to-r from-violet-50/50 to-[#1D9E75]/5 px-4 py-3 dark:from-violet-950/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Campaign Success Score
            </p>
            <p className="text-3xl font-bold text-[#1D9E75]">{data.score}%</p>
          </div>
          <Progress value={data.score} className="h-2 w-32 [&>div]:bg-[#1D9E75]" />
        </div>
        <GroundingFooter grounding={data.grounding} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ListBlock label="Top Strengths" items={data.strengths} color="text-[#1D9E75]" />
        <ListBlock label="Weaknesses" items={data.weaknesses} color="text-amber-600" />
        <ListBlock label="Risks" items={data.risks} color="text-red-600" />
        <ListBlock label="How to Improve" items={data.improvements} color="text-violet-600" />
      </div>
    </div>
  );
}
