import type { SupabaseClient } from "@supabase/supabase-js";

import { assessBusinessChangeImpact } from "@/lib/change-impact/assess";
import { feedChangeImpactTimeline } from "@/lib/change-impact/feeds/timeline";
import type {
  ApplyChangeImpactInput,
  ChangeImpactAssessment,
} from "@/lib/change-impact/types";
import {
  applyDocumentLifecycleReactions,
  planDocumentLifecycleReactions,
} from "@/lib/document-lifecycle/business-change/emit";

export type ApplyChangeImpactResult =
  | {
      ok: true;
      eventId: string;
      assessmentId: string;
      assessment: ChangeImpactAssessment;
    }
  | { ok: false; error: string };

/**
 * Enterprise Change Impact Engine — primary entry point.
 *
 * 1. Record business change event
 * 2. Plan document reactions (Document Lifecycle — plan only)
 * 3. Assess business impact (severity, explanation, recommendations, AI)
 * 4. Persist assessment + feeds (Decision Center / Notifications / Timeline)
 * 5. Apply document state transitions (Document Lifecycle — apply only)
 */
export async function applyBusinessChangeImpact(
  supabase: SupabaseClient,
  input: ApplyChangeImpactInput
): Promise<ApplyChangeImpactResult> {
  const { data: eventRow, error: eventError } = await supabase
    .from("business_change_events")
    .insert({
      event_type: input.eventType,
      reason_code: input.reasonCode,
      reason_detail: input.reasonDetail,
      campaign_header_id: input.campaignHeaderId,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      payload: {
        ...(input.payload ?? {}),
        estimated_impact: input.estimatedImpact ?? null,
      },
      actor_id: input.actorId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (eventError || !eventRow) {
    return {
      ok: false,
      error: eventError?.message ?? "Failed to record business change event.",
    };
  }

  const eventId = (eventRow as { id: string }).id;

  let lifecycleReactions;
  try {
    lifecycleReactions = await planDocumentLifecycleReactions(supabase, input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to plan document lifecycle reactions.",
    };
  }

  const assessment = assessBusinessChangeImpact(input, lifecycleReactions);

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from("change_impact_assessments")
    .insert({
      business_change_event_id: eventId,
      campaign_header_id: input.campaignHeaderId,
      event_type: assessment.eventType,
      reason_code: assessment.reasonCode,
      reason_detail: assessment.reasonDetail,
      severity: assessment.severity,
      business_impact_summary: assessment.businessImpactSummary,
      business_impact_detail: assessment.businessImpactDetail,
      recommended_actions: assessment.recommendedActions.map((a) => a.label),
      status: "open",
      ai_context: assessment.aiRecommendation,
      actor_id: input.actorId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (assessmentError || !assessmentRow) {
    return {
      ok: false,
      error:
        assessmentError?.message ?? "Failed to persist change impact assessment.",
    };
  }

  const assessmentId = (assessmentRow as { id: string }).id;

  if (assessment.affectedObjects.length > 0) {
    await supabase.from("change_impact_affected_objects").insert(
      assessment.affectedObjects.map((obj) => ({
        assessment_id: assessmentId,
        object_type: obj.objectType,
        object_id: obj.objectId,
        object_label: obj.objectLabel,
        role: obj.role,
      })) as never
    );
  }

  if (assessment.documentImpacts.length > 0) {
    await supabase.from("change_impact_document_impacts").insert(
      assessment.documentImpacts.map((doc) => ({
        assessment_id: assessmentId,
        document_type: doc.documentType,
        document_id: doc.documentId,
        document_label: doc.documentLabel,
        from_status: doc.fromStatus,
        planned_to_status: doc.plannedToStatus,
        severity: doc.severity,
        impact_explanation: doc.impactExplanation,
        recommended_actions: doc.recommendedActions,
        lifecycle_applied: false,
      })) as never
    );
  }

  if (assessment.notificationIntents.length > 0) {
    await supabase.from("change_impact_notification_intents").insert(
      assessment.notificationIntents.map((intent) => ({
        assessment_id: assessmentId,
        audience: intent.audience,
        channel: intent.channel,
        title: intent.title,
        body: intent.body,
        status: "pending",
        payload: intent.payload ?? {},
      })) as never
    );
  }

  // Timeline feed (non-blocking)
  try {
    await feedChangeImpactTimeline(supabase, {
      campaignHeaderId: input.campaignHeaderId,
      actorId: input.actorId,
      assessmentId,
      eventId,
      assessment,
    });
  } catch {
    // Timeline must not roll back impact persistence.
  }

  const applied = await applyDocumentLifecycleReactions(supabase, {
    eventId,
    actorId: input.actorId,
    estimatedImpact: input.estimatedImpact,
    reactions: assessment.lifecycleReactions,
  });

  if (!applied.ok) {
    return { ok: false, error: applied.error };
  }

  if (assessment.documentImpacts.length > 0) {
    await supabase
      .from("change_impact_document_impacts")
      .update({ lifecycle_applied: true } as never)
      .eq("assessment_id", assessmentId);
  }

  return {
    ok: true,
    eventId,
    assessmentId,
    assessment,
  };
}
