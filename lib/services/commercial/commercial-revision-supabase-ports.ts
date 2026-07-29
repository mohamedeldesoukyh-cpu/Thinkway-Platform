/**
 * Supabase-backed Commercial Revision ports (Phase 4 persistence).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { hasPermission } from "@/lib/auth/permissions";
import { Campaign } from "@/lib/finance/campaign-finance-lock";
import type { Database } from "@/types/database";

import type { CommercialRevisionPorts } from "./commercial-revision-ports";
import type {
  CommercialRevisionLineInput,
  CommercialRevisionRecord,
  CommercialRevisionStatus,
  CommercialVersionHistoryEntry,
} from "./commercial-revision-types";
import type { MasterCommercialValues, MasterFieldChange } from "./types";
import { masterFieldLabel } from "./field-registry";
import { createSupabaseCommercialSyncPorts } from "./supabase-ports";

type Supabase = SupabaseClient<Database>;

type RevisionRow = {
  id: string;
  campaign_header_id: string;
  quotation_id: string;
  revision_number: number;
  commercial_version_number: number | null;
  status: string;
  reason: string;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  decision_notes: string | null;
  applied_at: string | null;
  concurrency_tokens: Record<string, string> | null;
};

type RevisionLineRow = {
  commercial_line_id: string;
  assignment_ids: string[] | null;
  old_values: MasterCommercialValues;
  new_values: MasterCommercialValues;
  changed_fields: string[] | null;
};

export function createSupabaseRevisionPorts(
  supabase: Supabase
): CommercialRevisionPorts {
  const syncPorts = createSupabaseCommercialSyncPorts(supabase);

  async function loadLines(
    revisionId: string
  ): Promise<CommercialRevisionLineInput[]> {
    const { data, error } = await supabase
      .from("commercial_revision_lines" as never)
      .select(
        "commercial_line_id, assignment_ids, old_values, new_values, changed_fields"
      )
      .eq("revision_id", revisionId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as RevisionLineRow[]).map((row) => ({
      commercialLineId: row.commercial_line_id,
      assignmentIds: row.assignment_ids ?? [],
      oldValues: row.old_values ?? {},
      newValues: row.new_values ?? {},
      changedFields: row.changed_fields ?? [],
      fieldChanges: toFieldChanges(
        row.old_values,
        row.new_values,
        row.changed_fields
      ),
    }));
  }

  async function mapRevision(
    row: RevisionRow
  ): Promise<CommercialRevisionRecord> {
    return {
      id: row.id,
      campaignHeaderId: row.campaign_header_id,
      quotationId: row.quotation_id,
      revisionNumber: row.revision_number,
      commercialVersionNumber: row.commercial_version_number,
      status: row.status as CommercialRevisionStatus,
      reason: row.reason,
      comments: row.comments,
      createdBy: row.created_by ?? "",
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at,
      decisionNotes: row.decision_notes,
      appliedAt: row.applied_at,
      concurrencyTokens: row.concurrency_tokens ?? {},
      lines: await loadLines(row.id),
    };
  }

  return {
    financeLocked: (campaignHeaderId) =>
      Campaign.isFinanceLocked(supabase, campaignHeaderId),
    lineExists: async (commercialLineId) => {
      const { data } = await supabase
        .from("quotation_items")
        .select("id")
        .eq("id", commercialLineId)
        .maybeSingle();
      return Boolean(data?.id);
    },
    canDecide: async () => {
      const [decide, admin] = await Promise.all([
        hasPermission(supabase, "approvals.decide"),
        hasPermission(supabase, "campaigns.admin"),
      ]);
      return decide || admin;
    },
    loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    getRevision: async (revisionId) => {
      const { data, error } = await supabase
        .from("commercial_revisions" as never)
        .select("*")
        .eq("id", revisionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapRevision(data as RevisionRow);
    },
    saveRevision: async (record) => {
      const payload = {
        id: record.id,
        campaign_header_id: record.campaignHeaderId,
        quotation_id: record.quotationId,
        revision_number: record.revisionNumber,
        commercial_version_number: record.commercialVersionNumber,
        status: record.status,
        reason: record.reason,
        comments: record.comments,
        created_by: record.createdBy || null,
        created_at: record.createdAt,
        submitted_at: record.submittedAt,
        approved_by: record.approvedBy,
        approved_at: record.approvedAt,
        rejected_by: record.rejectedBy,
        rejected_at: record.rejectedAt,
        decision_notes: record.decisionNotes,
        applied_at: record.appliedAt,
        concurrency_tokens: record.concurrencyTokens,
      };

      const { error } = await supabase
        .from("commercial_revisions" as never)
        .upsert(payload as never);
      if (error) throw new Error(error.message);

      await supabase
        .from("commercial_revision_lines" as never)
        .delete()
        .eq("revision_id", record.id);

      if (record.lines.length > 0) {
        const { error: linesError } = await supabase
          .from("commercial_revision_lines" as never)
          .insert(
            record.lines.map((line) => ({
              revision_id: record.id,
              commercial_line_id: line.commercialLineId,
              assignment_ids: line.assignmentIds ?? [],
              old_values: line.oldValues,
              new_values: line.newValues,
              changed_fields: line.changedFields,
            })) as never
          );
        if (linesError) throw new Error(linesError.message);
      }
    },
    listRevisions: async (campaignHeaderId) => {
      const { data, error } = await supabase
        .from("commercial_revisions" as never)
        .select("*")
        .eq("campaign_header_id", campaignHeaderId)
        .order("revision_number", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as RevisionRow[];
      return Promise.all(rows.map(mapRevision));
    },
    findPendingRevision: async (campaignHeaderId) => {
      const { data, error } = await supabase
        .from("commercial_revisions" as never)
        .select("*")
        .eq("campaign_header_id", campaignHeaderId)
        .eq("status", "pending_approval")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapRevision(data as RevisionRow);
    },
    nextRevisionNumber: async (campaignHeaderId) => {
      const { data, error } = await supabase
        .from("commercial_revisions" as never)
        .select("revision_number")
        .eq("campaign_header_id", campaignHeaderId)
        .order("revision_number", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const max = Number(
        ((data ?? [])[0] as { revision_number?: number } | undefined)
          ?.revision_number ?? 0
      );
      return max + 1;
    },
    nextCommercialVersion: async (campaignHeaderId) => {
      const { data, error } = await supabase
        .from("campaign_commercial_snapshots")
        .select("version_number")
        .eq("campaign_header_id", campaignHeaderId)
        .order("version_number", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const max = Number(
        ((data ?? [])[0] as { version_number?: number | null } | undefined)
          ?.version_number ?? 0
      );
      return max > 0 ? max + 1 : 2;
    },
    appendVersionHistory: async (entry) => {
      const { data: quote } = await supabase
        .from("commercial_revisions" as never)
        .select("quotation_id")
        .eq("id", entry.revisionId ?? "")
        .maybeSingle();

      const quotationId = (quote as { quotation_id?: string } | null)
        ?.quotation_id;
      if (!quotationId) {
        throw new Error("Cannot append version history without quotation_id");
      }

      const { data: quotation } = await supabase
        .from("quotations")
        .select("serial_number")
        .eq("id", quotationId)
        .maybeSingle();

      const { error } = await supabase
        .from("campaign_commercial_snapshots")
        .insert({
          campaign_header_id: entry.campaignHeaderId,
          quotation_id: quotationId,
          quotation_serial:
            (quotation as { serial_number?: string | null } | null)
              ?.serial_number ?? null,
          version_number: entry.versionNumber,
          payload: {
            reason: entry.reason,
            revision_number: entry.revisionNumber,
            revision_id: entry.revisionId,
            field_changes: entry.fieldChangeSummary,
            approved_by: entry.approvedBy,
            created_by: entry.createdBy,
          },
          created_by: entry.approvedBy ?? entry.createdBy,
          commercial_revision_id: entry.revisionId,
        } as never);
      if (error) throw new Error(error.message);
    },
    listVersionHistory: async (campaignHeaderId) => {
      const { data, error } = await supabase
        .from("campaign_commercial_snapshots")
        .select(
          "id, version_number, created_at, created_by, payload, commercial_revision_id"
        )
        .eq("campaign_header_id", campaignHeaderId)
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<{
        id: string;
        version_number: number | null;
        created_at: string;
        created_by: string | null;
        payload: Record<string, unknown> | null;
        commercial_revision_id?: string | null;
      }>).map((row) => {
        const payload = row.payload ?? {};
        return {
          versionNumber: Number(row.version_number ?? 0),
          revisionNumber:
            typeof payload.revision_number === "number"
              ? payload.revision_number
              : null,
          revisionId: row.commercial_revision_id ?? null,
          campaignHeaderId,
          createdBy: row.created_by,
          approvedBy:
            typeof payload.approved_by === "string" ? payload.approved_by : null,
          date: row.created_at,
          reason: typeof payload.reason === "string" ? payload.reason : null,
          fieldChangeSummary: Array.isArray(payload.field_changes)
            ? (payload.field_changes as MasterFieldChange[])
            : [],
          snapshotId: row.id,
        } satisfies CommercialVersionHistoryEntry;
      });
    },
  };
}

function toFieldChanges(
  oldValues: MasterCommercialValues,
  newValues: MasterCommercialValues,
  changedFields: string[] | null
): MasterFieldChange[] {
  const keys = changedFields?.length
    ? changedFields
    : Object.keys(newValues);
  return keys.map((field) => {
    const key = field as MasterFieldChange["field"];
    return {
      field: key,
      label: masterFieldLabel(key),
      oldValue: oldValues[key],
      newValue: newValues[key],
    };
  });
}
