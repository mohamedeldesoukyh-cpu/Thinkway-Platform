"use client";

import { CheckCircle2Icon, CircleIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

import { sanitizeTimelineText } from "./shared/format-utils";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { resolveTimelineData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type TimelineSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const STATUS_ICON = {
  complete: CheckCircle2Icon,
  in_progress: Loader2Icon,
  pending: CircleIcon,
} as const;

export function TimelineSection({
  campaignObject,
  fallbackText,
  status,
}: TimelineSectionProps) {
  const isRunning = status === "running";
  const timeline = resolveTimelineData(campaignObject);

  if (isRunning && !timeline) {
    return <SectionSkeleton variant="timeline" />;
  }

  if (!timeline || timeline.weeks.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Timeline pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {timeline.durationWeeks} weeks
        {timeline.goLiveWeek ? ` · Go-live Week ${timeline.goLiveWeek}` : ""}
      </p>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {timeline.weeks.map((week) => {
          const Icon = STATUS_ICON[week.status];
          const isActive = week.status === "in_progress";

          return (
            <div
              key={`week-${week.week}`}
              className={cn(
                "min-w-0 overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-300",
                week.status === "complete" && "border-[#1D9E75]/30 bg-[#1D9E75]/5",
                isActive && "border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20",
                week.status === "pending" && "border-border/60 bg-muted/20"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    week.status === "complete" && "text-[#1D9E75]",
                    isActive && "animate-spin text-violet-600",
                    week.status === "pending" && "text-muted-foreground/50"
                  )}
                />
                <span className="text-[10px] font-bold tracking-wide text-violet-600 uppercase dark:text-violet-400">
                  Week {week.week}
                </span>
              </div>
              <p className="mt-1 break-words text-sm font-semibold">
                {sanitizeTimelineText(week.phase)}
              </p>
              {week.activities.length > 0 ? (
                <div className="mt-1.5">
                  <p className="text-[9px] font-bold tracking-wide text-muted-foreground uppercase">Activities</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {week.activities.slice(0, 2).map((a) => (
                      <li key={a} className="break-words text-[11px] text-muted-foreground">
                        · {sanitizeTimelineText(a)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {week.deliverables.length > 0 ? (
                <div className="mt-1">
                  <p className="text-[9px] font-bold tracking-wide text-muted-foreground uppercase">Expected Output</p>
                  <p className="break-words text-[11px] text-foreground">
                    {week.deliverables.map(sanitizeTimelineText).join(", ")}
                  </p>
                </div>
              ) : null}
              {week.milestones.length > 0 ? (
                <div className="mt-1">
                  <p className="text-[9px] font-bold tracking-wide text-muted-foreground uppercase">Milestone</p>
                  <p className="break-words text-[11px] text-foreground">
                    {sanitizeTimelineText(week.milestones[0])}
                  </p>
                </div>
              ) : null}
              <div className="mt-1.5 space-y-0.5 text-[10px]">
                <p>
                  <span className="font-semibold text-muted-foreground">Owner:</span>{" "}
                  {sanitizeTimelineText(week.owner)}
                </p>
                {week.dependencies.length > 0 ? (
                  <p>
                    <span className="font-semibold text-muted-foreground">Dependencies:</span>{" "}
                    {week.dependencies.map(sanitizeTimelineText).join(", ")}
                  </p>
                ) : null}
                {week.approvalGates.length > 0 ? (
                  <p className="font-semibold text-[#1D9E75]">
                    Approval: {week.approvalGates.map(sanitizeTimelineText).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
