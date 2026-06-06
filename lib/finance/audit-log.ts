import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { FinanceAuditEvent } from "@/lib/finance/audit-events";
import { FINANCE_AUDIT_EVENT_LABELS } from "@/lib/finance/audit-events";
import type { Database } from "@/types/database";

export type FinanceAuditLogInput = {
  event: FinanceAuditEvent;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  payload?: Record<string, unknown>;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
};

export async function logFinanceAuditEvent(
  supabase: SupabaseClient<Database>,
  input: FinanceAuditLogInput
) {
  return insertAuditLog(supabase, {
    action: "update",
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    actor_id: input.actor_id,
    old_data: input.old_data ?? null,
    new_data: input.new_data ?? null,
    metadata: {
      event: input.event,
      label: FINANCE_AUDIT_EVENT_LABELS[input.event] ?? input.event,
      ...input.payload,
    },
  });
}
