import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { normalizeAuditAction } from "./audit-action";

export type InsertAuditLogInput = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export async function insertAuditLog(
  supabase: SupabaseClient<Database>,
  input: InsertAuditLogInput
) {
  const action = normalizeAuditAction(input.action);

  return supabase.from("audit_logs").insert({
    action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    actor_id: input.actor_id ?? null,
    old_data: input.old_data ?? null,
    new_data: input.new_data ?? null,
    metadata: input.metadata ?? {},
  });
}
