import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type QuotationLifecycleAuditEvent =
  | "quotation.creator_added"
  | "quotation.creator_removed"
  | "quotation.commercial_updated"
  | "quotation.deliverables_updated"
  | "quotation.version_created"
  | "quotation.campaign_created"
  | "quotation.shortlist_created"
  | "quotation.client_promoted"
  | "quotation.brand_promoted"
  | "quotation.sync_shortlist_to_quotation"
  | "quotation.sync_quotation_to_shortlist";

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
