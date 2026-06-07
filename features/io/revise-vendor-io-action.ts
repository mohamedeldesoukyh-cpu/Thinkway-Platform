"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { effectiveLineOperationalStatus } from "@/lib/campaigns/effective-operational-status";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { logReviseVendorIo } from "@/lib/io/revise-vendor-io-log";
import {
  vendorIoBaseDocumentNumber,
  vendorIoRevisionDocumentNumber,
} from "@/lib/io/vendor-io-revision";
import { finalizeLineBillingAfterVendorIoRevisionBatch } from "@/lib/billing/vendor-io-revision-line-billing";
import { sumVendorIoLineAmounts } from "@/lib/io/vendor-io-line-amount";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviseVendorIoSchema = z.object({
  campaign_id: z.string().uuid(),
  line_ids: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().uuid()).min(1, "Select at least one assignment line.")),
  reason: z.string().trim().min(3, "Reason is required (min 3 characters)."),
});

export type ReviseVendorIoState = {
  ok: boolean;
  message?: string;
  revised_line_ids?: string[];
  new_vendor_io_ids?: string[];
};

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

/**
 * Creates a new vendor_ios row (Option A) with /n revision after invoice ungenerate + correction.
 * Only for lines in `reopened` operational status.
 */
export async function reviseVendorIosFromLinesAction(
  _prev: ReviseVendorIoState,
  formData: FormData
): Promise<ReviseVendorIoState> {
  const parsed = reviseVendorIoSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    line_ids: formData.get("line_ids"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { supabase, user, error: authError } = await requireAuth();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { campaign_id: campaignId, line_ids: lineIds, reason } = parsed.data;

  logReviseVendorIo("start", { campaignId, lineIds, reasonLength: reason.length });

  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select(
      "id, name, revenue, revenue_before_vat, cost, cost_before_vat, operational_status, vendor_io_id, finance_override_until, invoice_id, billing_status"
    )
    .eq("campaign_header_id", campaignId)
    .in("id", lineIds);

  if (linesError) {
    logReviseVendorIo("lines_query_failed", { message: linesError.message });
    return { ok: false, message: linesError.message };
  }

  if (!lines?.length) {
    return { ok: false, message: "No assignment lines found." };
  }

  type LineRow = {
    id: string;
    name: string;
    revenue: number;
    revenue_before_vat?: number | null;
    cost?: number | null;
    cost_before_vat?: number | null;
    operational_status: string;
    vendor_io_id: string | null;
    finance_override_until: string | null;
    invoice_id: string | null;
    billing_status: string;
  };

  const typed = lines as unknown as LineRow[];

  for (const line of typed) {
    const status = effectiveLineOperationalStatus({
      operational_status: line.operational_status,
      vendor_io_id: line.vendor_io_id,
      invoice_id: line.invoice_id,
      billing_status: line.billing_status,
      finance_override_until: line.finance_override_until,
    }) as CampaignLineOperationalStatus;

    logReviseVendorIo("eligibility_check", {
      lineId: line.id,
      status,
      vendor_io_id: line.vendor_io_id,
      billing_status: line.billing_status,
      invoice_id: line.invoice_id,
    });

    if (status !== "reopened") {
      return {
        ok: false,
        message: `Line "${line.name}" must be reopened (invoice ungenerated) before creating a VIO revision.`,
      };
    }
    if (!line.vendor_io_id) {
      return {
        ok: false,
        message: `Line "${line.name}" has no Vendor IO to revise.`,
      };
    }
  }

  const byVendorIo = new Map<string, LineRow[]>();
  for (const line of typed) {
    const list = byVendorIo.get(line.vendor_io_id!) ?? [];
    list.push(line);
    byVendorIo.set(line.vendor_io_id!, list);
  }

  const revisedLineIds: string[] = [];
  const newVendorIoIds: string[] = [];
  let revised = 0;

  for (const [oldVioId, groupLines] of byVendorIo) {
    logReviseVendorIo("group_start", {
      oldVioId,
      lineIds: groupLines.map((l) => l.id),
    });

    const { data: oldVio, error: oldError } = await supabase
      .from("vendor_ios")
      .select(
        "id, document_number, revision_number, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status, terms_text, terms_html, usage_rights, exclusivity, attachment_url, root_vendor_io_id, is_superseded"
      )
      .eq("id", oldVioId)
      .maybeSingle();

    if (oldError || !oldVio) {
      logReviseVendorIo("old_vio_missing", { oldVioId, message: oldError?.message });
      return { ok: false, message: oldError?.message ?? "Vendor IO not found." };
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
      status: string;
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
        message: "Selected Vendor IO is already superseded. Use the active revision.",
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

    logReviseVendorIo("revision_plan", {
      oldVioId: old.id,
      rootId,
      nextRevision,
      nextDoc,
      supersede: true,
    });

    const groupTotal = sumVendorIoLineAmounts(groupLines);

    const { error: supersedeError } = await supabase
      .from("vendor_ios")
      .update({ is_superseded: true, updated_by: user.id } as never)
      .eq("id", old.id);

    if (supersedeError) {
      logReviseVendorIo("supersede_failed", { message: supersedeError.message });
      return { ok: false, message: supersedeError.message };
    }

    const { data: newVio, error: insertError } = await supabase
      .from("vendor_ios")
      .insert({
        assignment_id: old.assignment_id,
        campaign_header_id: old.campaign_header_id,
        influencer_id: old.influencer_id,
        amount: groupTotal || old.amount,
        currency_code: old.currency_code,
        status: "draft",
        terms_text: old.terms_text
          ? `${old.terms_text}\n\n[Revision ${nextRevision}: ${reason}]`
          : `Revision ${nextRevision}: ${reason}`,
        terms_html: old.terms_html,
        usage_rights: old.usage_rights,
        exclusivity: old.exclusivity,
        attachment_url: old.attachment_url,
        created_by: user.id,
        updated_by: user.id,
        revision_number: nextRevision,
        document_number: nextDoc,
        replaces_vendor_io_id: old.id,
        root_vendor_io_id: rootId,
        is_superseded: false,
      } as never)
      .select("id, document_number")
      .single();

    if (insertError || !newVio) {
      await supabase
        .from("vendor_ios")
        .update({ is_superseded: false } as never)
        .eq("id", old.id);
      logReviseVendorIo("insert_failed", { message: insertError?.message });
      return { ok: false, message: insertError?.message ?? "Failed to create VIO revision." };
    }

    const newVioId = (newVio as { id: string; document_number: string }).id;
    const newDoc = (newVio as { document_number: string }).document_number;
    newVendorIoIds.push(newVioId);

    logReviseVendorIo("insert_ok", { newVioId, newDoc, replaces: old.id });

    const { data: linkedLines } = await supabase
      .from("vendor_io_lines")
      .select("campaign_line_id")
      .eq("vendor_io_id", old.id);

    const lineIdsToMove = new Set([
      ...groupLines.map((l) => l.id),
      ...(linkedLines ?? []).map((r) => (r as { campaign_line_id: string }).campaign_line_id),
    ]);

    for (const lineId of lineIdsToMove) {
      const { error: deleteLinkError } = await supabase
        .from("vendor_io_lines")
        .delete()
        .eq("campaign_line_id", lineId);

      if (deleteLinkError) {
        logReviseVendorIo("vendor_io_lines_delete_failed", {
          lineId,
          message: deleteLinkError.message,
        });
        return { ok: false, message: deleteLinkError.message };
      }

      const { error: insertLinkError } = await supabase.from("vendor_io_lines").insert({
        vendor_io_id: newVioId,
        campaign_line_id: lineId,
      } as never);

      if (insertLinkError) {
        logReviseVendorIo("vendor_io_lines_insert_failed", {
          lineId,
          message: insertLinkError.message,
        });
        return { ok: false, message: insertLinkError.message };
      }

      const { error: lineUpdateError } = await supabase
        .from("campaign_lines")
        .update({
          vendor_io_id: newVioId,
          finance_override_until: null,
        } as never)
        .eq("id", lineId);

      if (lineUpdateError) {
        logReviseVendorIo("line_update_failed", { lineId, message: lineUpdateError.message });
        return { ok: false, message: lineUpdateError.message };
      }

      revisedLineIds.push(lineId);
      logReviseVendorIo("line_linked", { lineId, newVioId, oldVioId: old.id });
    }

    const { count: staleCount } = await supabase
      .from("campaign_lines")
      .select("id", { count: "exact", head: true })
      .eq("vendor_io_id", old.id);

    if ((staleCount ?? 0) > 0) {
      logReviseVendorIo("stale_vendor_io_refs_remain", { oldVioId: old.id, staleCount });
    }

    revised += 1;
  }

  const uniqueLineIds = [...new Set(revisedLineIds)];
  await finalizeLineBillingAfterVendorIoRevisionBatch(supabase, uniqueLineIds);

  for (const lineId of uniqueLineIds) {
    const { data: snapshot } = await supabase
      .from("campaign_lines")
      .select("operational_status, billing_status, vendor_io_id, invoice_id")
      .eq("id", lineId)
      .maybeSingle();

    const snap = snapshot as {
      operational_status: string;
      billing_status: string;
      vendor_io_id: string | null;
      invoice_id: string | null;
    } | null;

    if (
      snap &&
      snap.operational_status === "reopened" &&
      ["invoiced", "paid", "partially_invoiced"].includes(snap.billing_status)
    ) {
      logReviseVendorIo("post_sync_invalid_pair", { lineId, snapshot: snap });
    } else {
      logReviseVendorIo("post_sync_status", { lineId, snapshot: snap ?? null });
    }
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  logReviseVendorIo("complete", {
    campaignId,
    revised,
    revisedLineIds: uniqueLineIds,
    newVendorIoIds,
  });

  return {
    ok: true,
    message:
      revised === 1
        ? "Vendor IO revision created. Lines are invoice-eligible again after corrections."
        : `${revised} Vendor IO revisions created.`,
    revised_line_ids: uniqueLineIds,
    new_vendor_io_ids: newVendorIoIds,
  };
}
