import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { QuotationLifecycleAuditEvent } from "@/lib/domains/audit/types";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type { QuotationLifecycleAuditEvent } from "@/lib/domains/audit/types";

export async function logQuotationLifecycleEvent(
  supabase: Supabase,
  input: {
    quotationId: string;
    actorId: string;
    event: QuotationLifecycleAuditEvent;
    summary: string;
    metadata?: Record<string, unknown>;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }
) {
  await insertAuditLog(supabase, {
    action: input.event,
    entity_type: "quotation",
    entity_id: input.quotationId,
    actor_id: input.actorId,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    metadata: { summary: input.summary, ...input.metadata },
  });
}
