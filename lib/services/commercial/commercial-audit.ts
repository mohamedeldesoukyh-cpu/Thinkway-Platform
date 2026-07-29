/**
 * Commercial SSOT audit helpers.
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import type { CommercialAuditEntry } from "./types";

type Supabase = SupabaseClient<Database>;

export type CommercialAuditEvent = CommercialAuditEntry["event"];

/**
 * Persist a commercial sync audit entry on Quotation and (when present) Campaign.
 * Metadata always includes Commercial Line ID, source, user, timestamp, result.
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
    user_id: entry.actorId,
    occurred_at: entry.occurredAt,
    result: entry.result,
    old_value: entry.oldData,
    new_value: entry.newData,
    field_changes: entry.fieldChanges ?? null,
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

export function createSupabaseAuditWriter(
  supabase: Supabase
): (entry: CommercialAuditEntry) => Promise<void> {
  return (entry) => writeCommercialSyncAudit(supabase, entry);
}

function summarize(entry: CommercialAuditEntry): string {
  switch (entry.event) {
    case "commercial.master_synced": {
      if (entry.fieldChanges && entry.fieldChanges.length > 0) {
        const lines = entry.fieldChanges.map(
          (c) => `${c.label}: ${formatAuditValue(c.oldValue)} → ${formatAuditValue(c.newValue)}`
        );
        return `Commercial Line ${entry.commercialLineId ?? "unknown"} — ${lines.join("; ")}`;
      }
      return `Master commercials synchronized for Commercial Line ${entry.commercialLineId ?? "unknown"}`;
    }
    case "commercial.sync_blocked_finance_lock":
      return "Commercial sync blocked — Campaign is finance-locked";
    case "commercial.sync_not_confirmed":
      return "Commercial sync skipped — confirmation required";
    case "commercial.sync_rejected":
      return "Commercial sync rejected";
    case "commercial.sync_rolled_back":
      return "Commercial sync rolled back after partial failure";
    case "commercial.sync_conflict":
      return "Commercial sync blocked — concurrency conflict";
    default:
      return "Commercial sync event";
  }
}

function formatAuditValue(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}
