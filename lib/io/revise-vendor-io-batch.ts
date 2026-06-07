import type { SupabaseClient } from "@supabase/supabase-js";

import { finalizeLineBillingAfterVendorIoRevisionBatch } from "@/lib/billing/vendor-io-revision-line-billing";
import { logReviseVendorIo } from "@/lib/io/revise-vendor-io-log";
import { resolveActiveVendorIoId } from "@/lib/io/vendor-io-active-link";
import { sumVendorIoLineAmounts } from "@/lib/io/vendor-io-line-amount";
import {
  vendorIoBaseDocumentNumber,
  vendorIoRevisionDocumentNumber,
} from "@/lib/io/vendor-io-revision";

export type ReviseVendorIoBatchResult = {
  ok: boolean;
  error?: string;
  revised_line_ids: string[];
  new_vendor_io_ids: string[];
};

/**
 * Creates VIO revisions (same base serial, /n suffix) for lines that already have Vendor IO.
 * Used during invoice regeneration when commercial fields changed (CASE B).
 */
export async function reviseVendorIoBatch(
  supabase: SupabaseClient,
  input: {
    campaignId: string;
    lineIds: string[];
    reason: string;
    userId: string;
  }
): Promise<ReviseVendorIoBatchResult> {
  const { campaignId, lineIds, reason, userId } = input;
  if (lineIds.length === 0) {
    return { ok: true, revised_line_ids: [], new_vendor_io_ids: [] };
  }

  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select(
      "id, name, revenue, revenue_before_vat, cost, cost_before_vat, vendor_io_id"
    )
    .eq("campaign_header_id", campaignId)
    .in("id", lineIds);

  if (linesError) {
    return { ok: false, error: linesError.message, revised_line_ids: [], new_vendor_io_ids: [] };
  }

  type LineRow = {
    id: string;
    name: string;
    revenue: number;
    revenue_before_vat?: number | null;
    cost?: number | null;
    cost_before_vat?: number | null;
    vendor_io_id: string | null;
  };
  const typed = (lines ?? []) as LineRow[];
  const missingIo = typed.filter((l) => !l.vendor_io_id);
  if (missingIo.length > 0) {
    return {
      ok: false,
      error: `Line "${missingIo[0]!.name}" has no Vendor IO to revise.`,
      revised_line_ids: [],
      new_vendor_io_ids: [],
    };
  }

  const byVendorIo = new Map<string, LineRow[]>();
  for (const line of typed) {
    const activeVendorIoId = await resolveActiveVendorIoId(supabase, line.vendor_io_id);
    if (!activeVendorIoId) {
      return {
        ok: false,
        error: `Line "${line.name}" has no active Vendor IO to revise.`,
        revised_line_ids: [],
        new_vendor_io_ids: [],
      };
    }
    const list = byVendorIo.get(activeVendorIoId) ?? [];
    list.push(line);
    byVendorIo.set(activeVendorIoId, list);
  }

  const revisedLineIds: string[] = [];
  const newVendorIoIds: string[] = [];

  for (const [oldVioId, groupLines] of byVendorIo) {
    const { data: oldVio, error: oldError } = await supabase
      .from("vendor_ios")
      .select(
        "id, document_number, revision_number, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status, terms_text, terms_html, usage_rights, exclusivity, attachment_url, root_vendor_io_id, is_superseded"
      )
      .eq("id", oldVioId)
      .maybeSingle();

    if (oldError || !oldVio) {
      return {
        ok: false,
        error: oldError?.message ?? "Vendor IO not found.",
        revised_line_ids: revisedLineIds,
        new_vendor_io_ids: newVendorIoIds,
      };
    }

    const old = oldVio as {
      id: string;
      document_number: string;
      revision_number: number;
      assignment_id: string;
      campaign_header_id: string;
      influencer_id: string;
      amount: number;
      currency_code: string;
      terms_text: string | null;
      terms_html: string | null;
      usage_rights: string | null;
      exclusivity: string | null;
      attachment_url: string | null;
      root_vendor_io_id: string | null;
      is_superseded: boolean;
    };

    if (old.is_superseded) {
      return {
        ok: false,
        error: "Selected Vendor IO is already superseded. Use the active revision.",
        revised_line_ids: revisedLineIds,
        new_vendor_io_ids: newVendorIoIds,
      };
    }

    const rootId = old.root_vendor_io_id ?? old.id;
    const { data: siblings } = await supabase
      .from("vendor_ios")
      .select("revision_number")
      .eq("root_vendor_io_id", rootId);

    const maxRevision = Math.max(
      old.revision_number,
      ...(siblings ?? []).map((s) => (s as { revision_number: number }).revision_number)
    );
    const nextRevision = maxRevision + 1;
    const baseDoc = vendorIoBaseDocumentNumber(old.document_number);
    const nextDoc = vendorIoRevisionDocumentNumber(baseDoc, nextRevision);

    logReviseVendorIo("regenerate_batch_revision", {
      oldVioId: old.id,
      nextRevision,
      nextDoc,
      lineIds: groupLines.map((l) => l.id),
    });

    const groupTotal = sumVendorIoLineAmounts(groupLines);

    const { error: supersedeError } = await supabase
      .from("vendor_ios")
      .update({ is_superseded: true, updated_by: userId } as never)
      .eq("id", old.id);

    if (supersedeError) {
      return {
        ok: false,
        error: supersedeError.message,
        revised_line_ids: revisedLineIds,
        new_vendor_io_ids: newVendorIoIds,
      };
    }

    const { data: newVio, error: insertError } = await supabase
      .from("vendor_ios")
      .insert({
        assignment_id: old.assignment_id,
        campaign_header_id: old.campaign_header_id,
        influencer_id: old.influencer_id,
        amount: groupTotal,
        currency_code: old.currency_code,
        status: "draft",
        terms_text: old.terms_text
          ? `${old.terms_text}\n\n[Revision ${nextRevision}: ${reason}]`
          : `Revision ${nextRevision}: ${reason}`,
        terms_html: old.terms_html,
        usage_rights: old.usage_rights,
        exclusivity: old.exclusivity,
        attachment_url: old.attachment_url,
        created_by: userId,
        updated_by: userId,
        revision_number: nextRevision,
        document_number: nextDoc,
        replaces_vendor_io_id: old.id,
        root_vendor_io_id: rootId,
        is_superseded: false,
      } as never)
      .select("id")
      .single();

    if (insertError || !newVio) {
      await supabase
        .from("vendor_ios")
        .update({ is_superseded: false } as never)
        .eq("id", old.id);
      return {
        ok: false,
        error: insertError?.message ?? "Failed to create VIO revision.",
        revised_line_ids: revisedLineIds,
        new_vendor_io_ids: newVendorIoIds,
      };
    }

    const newVioId = (newVio as { id: string }).id;
    newVendorIoIds.push(newVioId);

    const { data: linkedLines } = await supabase
      .from("vendor_io_lines")
      .select("campaign_line_id")
      .eq("vendor_io_id", old.id);

    const lineIdsToMove = new Set([
      ...groupLines.map((l) => l.id),
      ...(linkedLines ?? []).map((r) => (r as { campaign_line_id: string }).campaign_line_id),
    ]);

    for (const lineId of lineIdsToMove) {
      await supabase.from("vendor_io_lines").delete().eq("campaign_line_id", lineId);

      const { error: insertLinkError } = await supabase.from("vendor_io_lines").insert({
        vendor_io_id: newVioId,
        campaign_line_id: lineId,
      } as never);

      if (insertLinkError) {
        return {
          ok: false,
          error: insertLinkError.message,
          revised_line_ids: revisedLineIds,
          new_vendor_io_ids: newVendorIoIds,
        };
      }

      await supabase
        .from("campaign_lines")
        .update({
          vendor_io_id: newVioId,
          finance_override_until: null,
          operational_status: "io_generated",
        } as never)
        .eq("id", lineId);

      revisedLineIds.push(lineId);
    }
  }

  await finalizeLineBillingAfterVendorIoRevisionBatch(supabase, revisedLineIds);

  return {
    ok: true,
    revised_line_ids: [...new Set(revisedLineIds)],
    new_vendor_io_ids: newVendorIoIds,
  };
}
