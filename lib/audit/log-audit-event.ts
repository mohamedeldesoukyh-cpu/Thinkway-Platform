import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/validation/uuid";
import type { Database } from "@/types/database";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "approve"
  | "reject"
  | "submit"
  | "publish"
  | "void"
  | "export";

export type AuditLogInput = {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  input: AuditLogInput
): Promise<void> {
  const entityRef =
    input.entityId && !isUuid(input.entityId) ? input.entityId : null;
  const entityId =
    input.entityId && isUuid(input.entityId) ? input.entityId : null;

  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: entityId,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(entityRef ? { entity_ref: entityRef } : {}),
      },
      ip_address: input.ip ?? null,
    } as Database["public"]["Tables"]["audit_logs"]["Insert"]);
    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (error) {
    console.error(
      "[audit] insert failed:",
      error instanceof Error ? error.message : error
    );
  }
}
