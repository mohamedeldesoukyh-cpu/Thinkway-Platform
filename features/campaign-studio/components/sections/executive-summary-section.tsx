"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { GroundingFooter } from "./shared/grounding-badge";
import { resolveExecutiveSummaryData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ExecutiveSummarySectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

function BulletBlock({ label, items, accent }: { label: string; items: string[]; accent?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <p className={`text-[10px] font-bold tracking-wide uppercase ${accent ?? "text-muted-foreground"}`}>
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="min-w-0 break-words text-[11px] leading-relaxed text-foreground">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveSummarySection({
  campaignObject,
  fallbackText,
  status,
}: ExecutiveSummarySectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const data = resolveExecutiveSummaryData(campaignObject);
  if (!data) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Executive summary pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 rounded-xl border border-[#1D9E75]/30 bg-gradient-to-br from-[#1D9E75]/5 to-violet-50/30 px-4 py-3 dark:to-violet-950/10">
        <p className="text-[10px] font-bold tracking-wide text-[#1D9E75] uppercase">
          Executive Summary
        </p>
        <p className="mt-1.5 min-w-0 break-words text-sm leading-relaxed font-medium text-foreground">
          {data.summary}
        </p>
        <GroundingFooter grounding={data.grounding} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <BulletBlock label="Key Decisions" items={data.keyDecisions} accent="text-violet-600" />
        <BulletBlock label="Recommended Actions" items={data.recommendedActions} accent="text-[#1D9E75]" />
        <BulletBlock label="Immediate Next Steps" items={data.immediateNextSteps} accent="text-indigo-600" />
        <div className="rounded-xl border border-violet-300/40 bg-violet-50/30 px-3 py-2.5 dark:bg-violet-950/20">
          <p className="text-[10px] font-bold tracking-wide text-violet-600 uppercase">
            Expected Business Outcome
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed">{data.expectedBusinessOutcome}</p>
        </div>
      </div>
    </div>
  );
}
