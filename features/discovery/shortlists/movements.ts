import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorMovementAction, Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type LogMovementInput = {
  action: CreatorMovementAction;
  sourceType: "discovery" | "shortlist" | "campaign";
  sourceId: string | null;
  destinationType: "shortlist" | "campaign" | "removed";
  destinationId: string | null;
  performedBy: string;
  influencerId?: string | null;
  discoveredProfileId?: string | null;
  unifiedId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only audit log (spec §11). Logs every creator movement across
 * discovery → shortlist → campaign and back. Best-effort: failures are logged,
 * never thrown, so they cannot roll back the primary mutation.
 */
export async function logCreatorMovement(
  supabase: Supabase,
  input: LogMovementInput
): Promise<void> {
  const creatorId = input.influencerId ?? input.discoveredProfileId ?? null;

  const { error } = await supabase.from("creator_movements").insert({
    creator_id: creatorId,
    influencer_id: input.influencerId ?? null,
    discovered_profile_id: input.discoveredProfileId ?? null,
    unified_id: input.unifiedId ?? null,
    source_type: input.sourceType,
    source_id: input.sourceId,
    destination_type: input.destinationType,
    destination_id: input.destinationId,
    action: input.action,
    performed_by: input.performedBy,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("[creator-movements] failed to log movement", error.message);
  }
}

export async function logCreatorMovementsBatch(
  supabase: Supabase,
  inputs: LogMovementInput[]
): Promise<void> {
  await Promise.all(inputs.map((input) => logCreatorMovement(supabase, input)));
}

/**
 * Shortlist lifecycle actions (submit/approve/reject/cancel/reopen/archive) are
 * list-level, not creator-level, so they record a movement row scoped to the
 * shortlist itself. Guarantees "no silent updates" — every business mutation
 * writes a movement row (review item 4).
 */
export type ShortlistLifecycleAction = Extract<
  CreatorMovementAction,
  | "shortlist_submitted"
  | "shortlist_approved"
  | "shortlist_rejected"
  | "shortlist_cancelled"
  | "shortlist_reopened"
  | "shortlist_archived"
>;

export async function logShortlistLifecycle(
  supabase: Supabase,
  input: {
    action: ShortlistLifecycleAction;
    shortlistId: string;
    performedBy: string;
    notes?: string | null;
  }
): Promise<void> {
  await logCreatorMovement(supabase, {
    action: input.action,
    sourceType: "shortlist",
    sourceId: input.shortlistId,
    destinationType: "shortlist",
    destinationId: input.shortlistId,
    performedBy: input.performedBy,
    notes: input.notes ?? null,
  });
}
