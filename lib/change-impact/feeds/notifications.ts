import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notification feed adapter.
 * Intents are persisted as `pending` by applyBusinessChangeImpact.
 * Future delivery workers mark them delivered — no email/push in this release.
 */
export async function listPendingChangeImpactNotifications(
  supabase: SupabaseClient,
  options?: { limit?: number; audience?: string }
) {
  let query = supabase
    .from("change_impact_notification_intents")
    .select(
      "id, assessment_id, audience, channel, title, body, status, payload, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.audience) {
    query = query.eq("audience", options.audience);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markChangeImpactNotificationDelivered(
  supabase: SupabaseClient,
  intentId: string
): Promise<void> {
  await supabase
    .from("change_impact_notification_intents")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
    } as never)
    .eq("id", intentId);
}
