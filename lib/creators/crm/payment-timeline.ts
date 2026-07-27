import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export async function logVendorPaymentTimelineEvent(
  supabase: Supabase,
  input: {
    influencerId: string;
    assignmentId?: string | null;
    vendorIoId?: string | null;
    eventType: string;
    summary: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("vendor_payment_timeline_events").insert({
    influencer_id: input.influencerId,
    assignment_id: input.assignmentId ?? null,
    vendor_io_id: input.vendorIoId ?? null,
    event_type: input.eventType,
    summary: input.summary,
    actor_id: input.actorId ?? null,
    metadata: input.metadata ?? {},
  } as never);
}
