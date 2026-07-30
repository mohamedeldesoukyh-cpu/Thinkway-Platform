import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import {
  buildEnterpriseTimelineMetadata,
  ENTERPRISE_TIMELINE_SOURCE,
  mapMediaPlanEngineEventToEnterprise,
} from "@/lib/timeline/enterprise-timeline-contract";

import {
  MEDIA_PLAN_TIMELINE_EVENT_LABELS,
  mediaPlanEventsForCampaignTimeline,
} from "./timeline-events";
import type { MediaPlanTimelineEvent } from "./types";

export type LogMediaPlanTimelineInput = {
  /** Campaign header id — required for Campaign Timeline Activity feed visibility. */
  campaignHeaderId: string;
  campaignObjectId: string;
  actorId: string | null;
  events: MediaPlanTimelineEvent[];
};

/**
 * Persist Media Plan lifecycle events to audit_logs so they appear in the
 * existing Campaign Timeline Activity feed. No separate timeline table.
 */
export async function logMediaPlanTimelineEvents(
  supabase: SupabaseClient<Database>,
  input: LogMediaPlanTimelineInput
): Promise<void> {
  const events = mediaPlanEventsForCampaignTimeline(input.events);
  if (!events.length || !input.campaignHeaderId.trim()) return;

  await Promise.all(
    events.map((event) => {
      const enterpriseEvent =
        mapMediaPlanEngineEventToEnterprise(event.type) ?? event.type;
      const metadata = buildEnterpriseTimelineMetadata({
        source: ENTERPRISE_TIMELINE_SOURCE,
        event: enterpriseEvent,
        label: MEDIA_PLAN_TIMELINE_EVENT_LABELS[event.type] ?? event.type,
        summary: event.summary,
        campaign_id: input.campaignHeaderId,
        campaign_header_id: input.campaignHeaderId,
        campaign_object_id: input.campaignObjectId,
        media_plan_id: event.mediaPlanId,
        version: event.version,
        module: "media_plan",
      });
      return insertAuditLog(supabase, {
        action: "update",
        entity_type: "campaign_headers",
        entity_id: input.campaignHeaderId,
        actor_id: input.actorId ?? event.actorUserId ?? null,
        old_data:
          event.previousValue != null
            ? ({ value: event.previousValue } as Record<string, unknown>)
            : null,
        new_data:
          event.newValue != null
            ? ({ value: event.newValue } as Record<string, unknown>)
            : null,
        metadata: {
          ...metadata,
          // Preserve legacy engine type for older Timeline filters.
          engine_event: event.type,
          source_engine: "media_plan_engine",
        } as unknown as Record<string, unknown>,
      });
    })
  );
}

/** Resolve linked campaign header id for a campaign object. */
export async function resolveCampaignHeaderIdForMediaPlan(
  supabase: SupabaseClient<Database>,
  campaignObjectId: string,
  fallbackCampaignId?: string | null
): Promise<string | null> {
  if (fallbackCampaignId?.trim()) return fallbackCampaignId.trim();

  const { data } = await supabase
    .from("campaign_objects")
    .select("campaign_header_id")
    .eq("id", campaignObjectId)
    .maybeSingle();

  return (data as { campaign_header_id?: string | null } | null)?.campaign_header_id ?? null;
}
