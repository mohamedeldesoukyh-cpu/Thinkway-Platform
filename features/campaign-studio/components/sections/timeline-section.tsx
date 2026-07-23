"use client";

import { sanitizeTimelineText } from "./shared/format-utils";
import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { WeekCard, WeekGrid } from "./shared/studio-ui-primitives";
import { resolveTimelineData } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type TimelineSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

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

  const reportingWeek = timeline.weeks.find((w) =>
    /report/i.test(w.phase) || /report/i.test(w.milestones.join(" "))
  );
  const activationWeeks = reportingWeek
    ? timeline.weeks.filter((w) => w.week !== reportingWeek.week)
    : timeline.weeks;

  return (
    <div className="min-w-0 space-y-2.5">
      <WeekGrid>
        {activationWeeks.map((week) => {
          const description =
            week.activities[0] ??
            week.deliverables[0] ??
            week.milestones[0] ??
            undefined;

          return (
            <WeekCard
              key={`week-${week.week}`}
              week={`Week ${week.week}`}
              title={sanitizeTimelineText(week.phase)}
              description={description ? sanitizeTimelineText(description) : undefined}
              owner={sanitizeTimelineText(week.owner)}
            />
          );
        })}
      </WeekGrid>
      {reportingWeek ? (
        <WeekCard
          week={`Week ${reportingWeek.week}`}
          title={sanitizeTimelineText(reportingWeek.phase)}
          description={
            reportingWeek.activities[0]
              ? sanitizeTimelineText(reportingWeek.activities[0])
              : "KPI readout against campaign objectives."
          }
          owner={sanitizeTimelineText(reportingWeek.owner)}
          highlight
        />
      ) : null}
    </div>
  );
}
