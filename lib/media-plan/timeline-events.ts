import type {
  MediaPlanState,
  MediaPlanTimelineEvent,
  MediaPlanTimelineEventType,
} from "./types";

export function buildMediaPlanTimelineEvent(input: {
  type: MediaPlanTimelineEventType;
  state: MediaPlanState;
  version: number | null;
  at: string;
  actorUserId?: string | null;
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
}): MediaPlanTimelineEvent {
  return {
    type: input.type,
    mediaPlanId: input.state.mediaPlanId,
    campaignId: input.state.campaignId,
    version: input.version,
    at: input.at,
    actorUserId: input.actorUserId ?? null,
    summary: input.summary,
    previousValue: input.previousValue,
    newValue: input.newValue,
  };
}

/** Campaign Timeline feed mapping — Phase 1+ wires these into campaign activity. */
export function mediaPlanEventsForCampaignTimeline(
  events: MediaPlanTimelineEvent[]
): MediaPlanTimelineEvent[] {
  return events.filter((event) =>
    (
      [
        "media_plan_created",
        "draft_created",
        "media_plan_regenerated",
        "media_plan_locked",
        "media_plan_unlocked",
        "client_approved",
        "approved_on_behalf",
        "revision_created",
        "baseline_published",
      ] as MediaPlanTimelineEventType[]
    ).includes(event.type)
  );
}
