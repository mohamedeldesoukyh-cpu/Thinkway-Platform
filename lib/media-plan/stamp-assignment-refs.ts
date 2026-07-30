/**
 * Stamp Assignment operational refs onto a rendered Media Plan calendar
 * from the current slate (by creatorId). Display fields stay unchanged.
 */

import type {
  MediaPlanAdditionalDeliverable,
  MediaPlanData,
  MediaPlanDay,
} from "@/features/campaign-outputs/generators/media-plan";
import type { SlateCreator } from "@/features/campaign-outputs/output-inputs";

function norm(id: string | null | undefined): string {
  return (id ?? "").trim().toLowerCase();
}

function stampEntry<T extends MediaPlanDay | MediaPlanAdditionalDeliverable>(
  entry: T,
  byCreator: Map<string, SlateCreator>
): T {
  if (entry.campaignLineId?.trim()) return entry;
  const creator = entry.creatorId ? byCreator.get(norm(entry.creatorId)) : undefined;
  if (!creator?.campaignLineId?.trim()) return entry;
  return {
    ...entry,
    campaignLineId: creator.campaignLineId,
    assignmentDeliverableId:
      entry.assignmentDeliverableId ?? creator.assignmentDeliverableId ?? null,
    assignmentPostScheduleId:
      entry.assignmentPostScheduleId ?? creator.assignmentPostScheduleId ?? null,
  };
}

export function stampMediaPlanAssignmentRefsFromSlate(
  data: MediaPlanData,
  slate: SlateCreator[]
): MediaPlanData {
  if (!slate.length) return data;
  const byCreator = new Map(slate.map((entry) => [norm(entry.creatorId), entry]));
  return {
    ...data,
    weeks: data.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => {
        const stamped = stampEntry(day, byCreator);
        return {
          ...stamped,
          additionalDeliverables: day.additionalDeliverables?.map((extra) =>
            stampEntry(extra, byCreator)
          ),
        };
      }),
    })),
  };
}
