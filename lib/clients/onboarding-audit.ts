import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { ClientOnboardingStatus } from "@/lib/clients/onboarding-status";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type ClientOnboardingAuditEvent =
  | "client.promoted"
  | "client.onboarding_status_changed"
  | "client.duplicate_overridden"
  | "client.existing_linked";

export async function logClientOnboardingEvent(
  supabase: Supabase,
  input: {
    clientId: string;
    actorId: string;
    event: ClientOnboardingAuditEvent;
    summary: string;
    quotationId?: string | null;
    brandId?: string | null;
    previousStatus?: ClientOnboardingStatus | null;
    newStatus?: ClientOnboardingStatus | null;
    metadata?: Record<string, unknown>;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }
) {
  await insertAuditLog(supabase, {
    action: "update",
    entity_type: "clients",
    entity_id: input.clientId,
    actor_id: input.actorId,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    metadata: {
      event: input.event,
      summary: input.summary,
      quotationId: input.quotationId ?? null,
      brandId: input.brandId ?? null,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      ...input.metadata,
    },
  });
}
