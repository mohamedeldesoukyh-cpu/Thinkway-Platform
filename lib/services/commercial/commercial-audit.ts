/**
 * Commercial SSOT audit helpers.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §5 / §6
 *
 * Every Master commercial change must be auditable with Commercial Line ID.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import type { CommercialAuditEntry } from "./types";

type Supabase = SupabaseClient<Database>;

export type CommercialAuditEvent = CommercialAuditEntry["event"];

/**
 * Persist a commercial sync audit entry.
 * Writes one audit_logs row on the Quotation (primary commercial document)
 * and, when a Campaign exists, a mirrored row on the Campaign header.
 */
export async function writeCommercialSyncAudit(
  supabase: Supabase,
  entry: CommercialAuditEntry
): Promise<void> {
  const metadata = {
    summary: summarize(entry),
    commercial_line_id: entry.commercialLineId,
    quotation_id: entry.quotationId,
    campaign_header_id: entry.campaignHeaderId,
    assignment_ids: entry.assignmentIds,
    source_side: entry.sourceSide,
    ...entry.metadata,
  };

  if (entry.quotationId) {
    await insertAuditLog(supabase, {
      action: entry.event,
      entity_type: "quotation",
      entity_id: entry.quotationId,
      actor_id: entry.actorId,
      old_data: entry.oldData,
      new_data: entry.newData,
      metadata,
    });
  }

  if (entry.campaignHeaderId) {
    await insertAuditLog(supabase, {
      action: entry.event,
      entity_type: "campaign_header",
      entity_id: entry.campaignHeaderId,
      actor_id: entry.actorId,
      old_data: entry.oldData,
      new_data: entry.newData,
      metadata,
    });
  }
}

/** Port-friendly wrapper used by CommercialSynchronizationService. */
export function createSupabaseAuditWriter(
  supabase: Supabase
): (entry: CommercialAuditEntry) => Promise<void> {
  return (entry) => writeCommercialSyncAudit(supabase, entry);
}

function summarize(entry: CommercialAuditEntry): string {
  switch (entry.event) {
    case "commercial.master_synced":
      return `Master commercials synchronized for Commercial Line ${entry.commercialLineId ?? "unknown"}`;
    case "commercial.sync_blocked_finance_lock":
      return "Commercial sync blocked — Campaign is finance-locked";
    case "commercial.sync_not_confirmed":
      return "Commercial sync skipped — confirmation required";
    case "commercial.sync_rejected":
      return "Commercial sync rejected";
    default:
      return "Commercial sync event";
  }
}
