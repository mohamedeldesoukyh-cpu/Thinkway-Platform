import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChangeImpactAssessment } from "@/lib/change-impact/types";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";

/**
 * Feed Enterprise Timeline from a Change Impact assessment.
 * Uses audit_logs spine — no parallel timeline store.
 */
export async function feedChangeImpactTimeline(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    actorId?: string | null;
    assessmentId: string;
    eventId: string;
    assessment: ChangeImpactAssessment;
  }
): Promise<void> {
  await emitEnterpriseTimelineEvent(supabase as never, {
    campaignHeaderId: input.campaignHeaderId,
    actorId: input.actorId,
    entityType: "change_impact_assessments",
    entityId: input.assessmentId,
    action: "create",
    metadata: {
      event: "commercial.revision",
      summary: input.assessment.businessImpactSummary,
      module: "change_impact",
      label: "Business change impact",
      change_impact_assessment_id: input.assessmentId,
      business_change_event_id: input.eventId,
      severity: input.assessment.severity,
      reason_code: input.assessment.reasonCode,
      document_impact_count: input.assessment.documentImpacts.length,
    } as never,
    newData: {
      severity: input.assessment.severity,
      event_type: input.assessment.eventType,
      recommended_actions: input.assessment.recommendedActions.map((a) => a.label),
    },
  });
}
