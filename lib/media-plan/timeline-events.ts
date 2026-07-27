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

const CAMPAIGN_TIMELINE_EVENT_TYPES: ReadonlySet<MediaPlanTimelineEventType> = new Set([
  "media_plan_created",
  "draft_created",
  "media_plan_regenerated",
  "media_plan_locked",
  "media_plan_unlocked",
  "client_approved",
  "approved_on_behalf",
  "revision_created",
  "baseline_published",
  "changes_requested",
  "rejected",
]);

/** Campaign Timeline Activity feed — excludes routine schedule_edited noise. */
export function mediaPlanEventsForCampaignTimeline(
  events: MediaPlanTimelineEvent[]
): MediaPlanTimelineEvent[] {
  return events.filter((event) => CAMPAIGN_TIMELINE_EVENT_TYPES.has(event.type));
}

export const MEDIA_PLAN_TIMELINE_EVENT_LABELS: Record<MediaPlanTimelineEventType, string> = {
  media_plan_created: "Media Plan created",
  draft_created: "Draft created",
  media_plan_regenerated: "Media Plan regenerated",
  media_plan_locked: "Media Plan locked",
  media_plan_unlocked: "Media Plan unlocked",
  client_approved: "Approved by client",
  approved_on_behalf: "Approved on behalf of client",
  revision_created: "Revision created",
  baseline_published: "Baseline published",
  changes_requested: "Changes requested",
  rejected: "Media Plan rejected",
  schedule_edited: "Schedule edited",
  sync: "Media Plan synced",
};
