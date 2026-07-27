import type { SupabaseClient } from "@supabase/supabase-js";

import { isCreatorCrmWritersEnabled } from "@/lib/creators/crm/feature-flag";
import {
  canConvertToCommercialCreator,
  isManualCrmActivationReason,
} from "@/lib/creators/crm/permissions";
import type {
  CreatorCrmStatus,
  EnsureCommercialCreatorInput,
  EnsureCommercialCreatorOutcome,
} from "@/lib/creators/crm/types";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Sole supported entry into the Commercial Creator (CRM) lifecycle.
 *
 * - Idempotent on influencer_id (PK).
 * - Never creates influencers, platform accounts, or discovered_profiles.
 * - Never advances Incomplete → Active automatically.
 * - Respects CREATOR_CRM_WRITERS_ENABLED (default OFF in Phase 2A).
 * - Identity lifecycle must not call this for Discovery import/Apify/promote alone.
 */
export async function ensureCommercialCreator(
  supabase: Supabase,
  input: EnsureCommercialCreatorInput
): Promise<EnsureCommercialCreatorOutcome> {
  if (isManualCrmActivationReason(input.reason) && !input.bypassRoleCheck) {
    if (!canConvertToCommercialCreator(input.roleSlug)) {
      return {
        ok: false,
        code: "permission_denied",
        message:
          "Only Account Manager, Operations, Admin, or Super Admin may manually activate a commercial creator.",
      };
    }
  }

  const influencerId = input.influencerId;
  const initialStatus: CreatorCrmStatus = input.initialStatus ?? "incomplete";

  if (!isCreatorCrmWritersEnabled()) {
    return {
      ok: true,
      influencerId,
      created: false,
      crmStatus: initialStatus,
      eventId: null,
      writersDisabled: true,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("creator_crm_profiles")
    .select("influencer_id, crm_status")
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, code: "db_error", message: existingError.message };
  }

  if (existing) {
    const eventId = await insertActivationEvent(supabase, input, influencerId);
    return {
      ok: true,
      influencerId,
      created: false,
      crmStatus: existing.crm_status,
      eventId,
    };
  }

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .select("id")
    .eq("id", influencerId)
    .maybeSingle();

  if (influencerError) {
    return { ok: false, code: "db_error", message: influencerError.message };
  }
  if (!influencer) {
    return {
      ok: false,
      code: "not_found",
      message: "Influencer identity not found; create identity before CRM activation.",
    };
  }

  const { error: insertError } = await supabase.from("creator_crm_profiles").insert({
    influencer_id: influencerId,
    crm_status: initialStatus,
    activated_by: input.actorId,
    activated_reason: input.reason,
  });

  if (insertError) {
    // Concurrent create: treat unique violation as idempotent success.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("creator_crm_profiles")
        .select("crm_status")
        .eq("influencer_id", influencerId)
        .maybeSingle();
      const eventId = await insertActivationEvent(supabase, input, influencerId);
      return {
        ok: true,
        influencerId,
        created: false,
        crmStatus: raced?.crm_status ?? initialStatus,
        eventId,
      };
    }
    return { ok: false, code: "db_error", message: insertError.message };
  }

  const eventId = await insertActivationEvent(supabase, input, influencerId);
  return {
    ok: true,
    influencerId,
    created: true,
    crmStatus: initialStatus,
    eventId,
  };
}

async function insertActivationEvent(
  supabase: Supabase,
  input: EnsureCommercialCreatorInput,
  influencerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("creator_crm_activation_events")
    .insert({
      influencer_id: influencerId,
      reason: input.reason,
      actor_id: input.actorId,
      source_entity_type: input.sourceEntityType ?? null,
      source_entity_id: input.sourceEntityId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique source index: repeated ensure with same source is not an error.
    if (error.code === "23505") return null;
    // Soft-fail event insert so profile creation still succeeds.
    return null;
  }
  return data?.id ?? null;
}
