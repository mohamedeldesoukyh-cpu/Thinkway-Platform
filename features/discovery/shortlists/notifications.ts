import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type ShortlistNotificationEvent =
  | "created"
  | "submitted_for_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "moved_to_campaign"
  | "returned_from_campaign";

const EVENT_TITLES: Record<ShortlistNotificationEvent, string> = {
  created: "Shortlist created",
  submitted_for_review: "Shortlist submitted for review",
  approved: "Shortlist approved",
  rejected: "Shortlist returned to draft",
  cancelled: "Shortlist cancelled",
  moved_to_campaign: "Creators moved to campaign",
  returned_from_campaign: "Creators returned from campaign",
};

export type NotifyShortlistInput = {
  shortlistId: string;
  event: ShortlistNotificationEvent;
  body?: string;
  actorId: string;
  /** Owner, Team Leader, Campaign Manager etc. Deduped + null-filtered internally. */
  recipientIds: Array<string | null | undefined>;
  metadata?: Record<string, unknown>;
};

/**
 * Minimal notification fan-out (spec §15). There is no general notifications
 * system in the schema (only finance/io/portal-scoped tables), so this writes to
 * the dedicated `shortlist_notifications` table. Best-effort: never throws.
 */
export async function notifyShortlistEvent(
  supabase: Supabase,
  input: NotifyShortlistInput
): Promise<void> {
  const recipients = Array.from(
    new Set(input.recipientIds.filter((id): id is string => Boolean(id)))
  );
  if (recipients.length === 0) return;

  const rows = recipients.map((recipientId) => ({
    shortlist_id: input.shortlistId,
    recipient_id: recipientId,
    event: input.event,
    title: EVENT_TITLES[input.event],
    body: input.body ?? null,
    created_by: input.actorId,
    metadata: input.metadata ?? {},
  }));

  const { error } = await supabase.from("shortlist_notifications").insert(rows);
  if (error) {
    console.error("[shortlist-notifications] failed to insert", error.message);
  }
}
