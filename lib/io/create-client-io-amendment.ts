import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientIoAmendmentDocumentNumber,
  clientIoBaseDocumentNumber,
  isClientIoAmendmentAllowed,
} from "@/lib/io/client-io-amendment";
import { listClientIoAssignmentIds } from "@/lib/io/client-io-assignments";
import { generateClientIoDocument } from "@/lib/io/client-io-document-service";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";

export type CreateClientIoAmendmentResult = {
  ok: true;
  priorClientIoId: string;
  newClientIoId: string;
  documentNumber: string;
  revisionNumber: number;
  generated: boolean;
};

export type CreateClientIoAmendmentError = {
  ok: false;
  error: string;
};

/**
 * Append-only Client IO amendment (Release 2.2.B).
 * Freezes the prior tip (is_superseded) and creates a new tip — never mutates prior artifacts.
 */
export async function createClientIoAmendment(
  supabase: SupabaseClient,
  input: {
    clientIoId: string;
    actorId: string;
    reason?: string | null;
    /** When true (default), regenerate branded document on the new tip. */
    generateDocument?: boolean;
  }
): Promise<CreateClientIoAmendmentResult | CreateClientIoAmendmentError> {
  const { data: tipRow, error: tipError } = await supabase
    .from("client_ios")
    .select(
      "id, document_number, revision_number, campaign_header_id, client_id, status, terms_text, billing_terms, attachment_url, send_recipients, is_superseded, root_client_io_id"
    )
    .eq("id", input.clientIoId)
    .maybeSingle();

  if (tipError || !tipRow) {
    return { ok: false, error: tipError?.message ?? "Client IO not found." };
  }

  const tip = tipRow as {
    id: string;
    document_number: string | null;
    revision_number: number | null;
    campaign_header_id: string;
    client_id: string;
    status: string;
    terms_text: string | null;
    billing_terms: string | null;
    attachment_url: string | null;
    send_recipients: unknown;
    is_superseded: boolean;
    root_client_io_id: string | null;
  };

  if (tip.is_superseded) {
    return {
      ok: false,
      error: "This Client IO is already superseded. Amend the current tip instead.",
    };
  }

  if (!isClientIoAmendmentAllowed(tip.status, tip.is_superseded)) {
    return {
      ok: false,
      error:
        "Amendments can be created after the Client IO is sent (or approved). Generate and send first.",
    };
  }

  if (!tip.document_number?.trim()) {
    return { ok: false, error: "Client IO is missing a document number." };
  }

  const rootId = tip.root_client_io_id ?? tip.id;
  const { data: siblings, error: siblingsError } = await supabase
    .from("client_ios")
    .select("revision_number")
    .eq("root_client_io_id", rootId);

  if (siblingsError) {
    return { ok: false, error: siblingsError.message };
  }

  const maxRevision = Math.max(
    Number(tip.revision_number ?? 0),
    ...((siblings ?? []) as Array<{ revision_number: number }>).map((row) =>
      Number(row.revision_number ?? 0)
    )
  );
  const nextRevision = maxRevision + 1;
  const baseDoc = clientIoBaseDocumentNumber(tip.document_number);
  const nextDoc = clientIoAmendmentDocumentNumber(baseDoc, nextRevision);
  const reason = input.reason?.trim() || null;

  const { error: supersedeError } = await supabase
    .from("client_ios")
    .update({
      is_superseded: true,
      updated_by: input.actorId,
    } as never)
    .eq("id", tip.id)
    .eq("is_superseded", false);

  if (supersedeError) {
    return { ok: false, error: supersedeError.message };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("client_ios")
    .insert({
      campaign_header_id: tip.campaign_header_id,
      client_id: tip.client_id,
      status: "draft",
      terms_text: tip.terms_text,
      billing_terms: tip.billing_terms,
      attachment_url: tip.attachment_url,
      send_recipients: tip.send_recipients ?? [],
      document_number: nextDoc,
      revision_number: nextRevision,
      is_superseded: false,
      replaces_client_io_id: tip.id,
      root_client_io_id: rootId,
      created_by: input.actorId,
      updated_by: input.actorId,
    } as never)
    .select("id, document_number")
    .single();

  if (insertError || !inserted) {
    await supabase
      .from("client_ios")
      .update({ is_superseded: false, updated_by: input.actorId } as never)
      .eq("id", tip.id);

    return {
      ok: false,
      error: insertError?.message ?? "Failed to create Client IO amendment.",
    };
  }

  const newId = (inserted as { id: string; document_number: string | null }).id;

  try {
    const selectedIds = await listClientIoAssignmentIds(supabase, tip.id);
    if (selectedIds.length > 0) {
      const { error: assignError } = await (supabase as any)
        .from("client_io_assignments")
        .insert(
          selectedIds.map((campaign_line_id) => ({
            client_io_id: newId,
            campaign_line_id,
          }))
        );
      if (assignError) {
        throw new Error(assignError.message);
      }
    }

    const { data: milestones } = await (supabase as any)
      .from("client_io_billing_milestones")
      .select(
        "label, milestone_kind, percent, amount, currency_code, due_date, due_trigger, due_offset_days, notes, sort_order, metadata"
      )
      .eq("client_io_id", tip.id)
      .order("sort_order", { ascending: true });

    if (Array.isArray(milestones) && milestones.length > 0) {
      const { error: milestoneError } = await (supabase as any)
        .from("client_io_billing_milestones")
        .insert(
          milestones.map((row: Record<string, unknown>) => ({
            label: row.label,
            milestone_kind: row.milestone_kind,
            percent: row.percent,
            amount: row.amount,
            currency_code: row.currency_code,
            due_date: row.due_date,
            due_trigger: row.due_trigger ?? "custom",
            due_offset_days: row.due_offset_days ?? null,
            notes: row.notes ?? null,
            sort_order: row.sort_order,
            metadata: row.metadata ?? {},
            client_io_id: newId,
            billing_status: "scheduled",
            invoice_id: null,
            eligible_at: null,
            invoiced_at: null,
            created_by: input.actorId,
            updated_by: input.actorId,
          }))
        );
      if (milestoneError) {
        throw new Error(milestoneError.message);
      }
    }
  } catch (copyError) {
    await supabase.from("client_ios").delete().eq("id", newId);
    await supabase
      .from("client_ios")
      .update({ is_superseded: false, updated_by: input.actorId } as never)
      .eq("id", tip.id);
    return {
      ok: false,
      error:
        copyError instanceof Error
          ? copyError.message
          : "Failed to copy Assignment selection to amendment.",
    };
  }

  let generated = false;
  if (input.generateDocument !== false) {
    try {
      await generateClientIoDocument(supabase, newId, input.actorId);
      generated = true;
    } catch (generateError) {
      console.warn("[client-io-amendment] generate failed", generateError);
    }
  }

  try {
    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId: tip.campaign_header_id,
      actorId: input.actorId,
      entityType: "client_ios",
      entityId: tip.id,
      action: "update",
      metadata: {
        event: "client_io.superseded",
        summary: `${tip.document_number} superseded by ${nextDoc}`,
        module: "client_io",
        client_io_id: tip.id,
      },
      oldData: { status: tip.status, is_superseded: false },
      newData: { is_superseded: true, replaced_by: newId },
    });

    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId: tip.campaign_header_id,
      actorId: input.actorId,
      entityType: "client_ios",
      entityId: newId,
      action: "create",
      metadata: {
        event: "client_io.amendment_created",
        summary: reason
          ? `Client IO amendment ${nextDoc} created — ${reason}`
          : `Client IO amendment ${nextDoc} created`,
        module: "client_io",
        client_io_id: newId,
        version: nextRevision,
      },
      newData: {
        document_number: nextDoc,
        revision_number: nextRevision,
        replaces_client_io_id: tip.id,
        root_client_io_id: rootId,
        reason,
      },
    });
  } catch (timelineError) {
    console.warn("[client-io-amendment] Timeline emit failed", timelineError);
  }

  return {
    ok: true,
    priorClientIoId: tip.id,
    newClientIoId: newId,
    documentNumber: nextDoc,
    revisionNumber: nextRevision,
    generated,
  };
}
