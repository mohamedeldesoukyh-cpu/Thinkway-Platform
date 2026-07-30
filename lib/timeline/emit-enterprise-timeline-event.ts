import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import {
  buildEnterpriseTimelineMetadata,
  type EnterpriseTimelineEventMetadata,
} from "./enterprise-timeline-contract";

export type EmitEnterpriseTimelineEventInput = {
  campaignHeaderId: string;
  actorId?: string | null;
  action?: "create" | "update" | "delete";
  /** Entity row the audit points at — defaults to campaign header. */
  entityType?: string;
  entityId?: string;
  metadata: Omit<EnterpriseTimelineEventMetadata, "source" | "label" | "campaign_header_id" | "campaign_id"> & {
    label?: string;
    source?: string;
    campaign_line_id?: string | null;
  };
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

/**
 * Append one Enterprise Timeline event to `audit_logs`.
 * Reuses the existing audit writer — no parallel timeline store.
 */
export async function emitEnterpriseTimelineEvent(
  supabase: SupabaseClient<Database>,
  input: EmitEnterpriseTimelineEventInput
): Promise<void> {
  const headerId = input.campaignHeaderId.trim();
  if (!headerId) return;

  const metadata = buildEnterpriseTimelineMetadata({
    ...input.metadata,
    campaign_id: headerId,
    campaign_header_id: headerId,
  });

  await insertAuditLog(supabase, {
    action: input.action ?? "update",
    entity_type: input.entityType ?? "campaign_headers",
    entity_id: input.entityId ?? headerId,
    actor_id: input.actorId ?? null,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    metadata: metadata as unknown as Record<string, unknown>,
  });
}
