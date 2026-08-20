import type { SupabaseClient } from "@supabase/supabase-js";

import { AUDIT_ACTIONS } from "@/lib/audit/audit-action";
import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { InsertAuditLogInput, QuotationLifecycleAuditEvent } from "@/lib/domains/audit/types";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type { QuotationLifecycleAuditEvent } from "@/lib/domains/audit/types";

export type QuotationLifecycleAuditInput = {
  quotationId: string;
  actorId?: string | null;
  event: QuotationLifecycleAuditEvent;
  summary: string;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

export function buildQuotationLifecycleAuditInsert(
  input: QuotationLifecycleAuditInput
): InsertAuditLogInput {
  const isClientApproved = input.event === "quotation.client_approved";
  const timestamp =
    typeof input.metadata?.timestamp === "string"
      ? input.metadata.timestamp
      : new Date().toISOString();

  return {
    action: isClientApproved ? AUDIT_ACTIONS.APPROVE : input.event,
    entity_type: "quotation",
    entity_id: input.quotationId,
    actor_id: input.actorId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    metadata: {
      ...input.metadata,
      summary: input.summary,
      entity: "quotation",
      event: isClientApproved ? "client_approved" : input.event,
      quotation_id: input.quotationId,
      timestamp,
      ...(isClientApproved
        ? {
            approval_source:
              typeof input.metadata?.approval_source === "string"
                ? input.metadata.approval_source
                : "client_workspace",
            actor_kind:
              typeof input.metadata?.actor_kind === "string"
                ? input.metadata.actor_kind
                : "client",
          }
        : {}),
    },
  };
}

export async function logQuotationLifecycleEvent(
  supabase: Supabase,
  input: QuotationLifecycleAuditInput
) {
  await insertAuditLog(supabase, buildQuotationLifecycleAuditInsert(input));
}
