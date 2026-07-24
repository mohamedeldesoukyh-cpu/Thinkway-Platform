"use server";

import { revalidatePath } from "next/cache";

import { requireFinancePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import { computeAdjustmentVatAmounts } from "@/lib/finance/credit-note-vat";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { createCreditNoteSchema } from "@/lib/validation/schemas";
import type { CreateClientCreditNoteInput } from "@/features/finance/adjustments/types";

export type FinanceAdjustmentActionState = {
  ok: boolean;
  message?: string;
  document_number?: string;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase, user };
}

export async function createClientCreditNoteAction(
  _prev: FinanceAdjustmentActionState,
  formData: FormData
): Promise<FinanceAdjustmentActionState> {
  try {
    const { supabase: baseClient, user } = await requireUser();
    const access = await requireFinancePermission(baseClient, "finance.write");
    if ("error" in access) return { ok: false, message: access.error };

    const supabase = asFinanceControlClient(baseClient);

    const parsed = createCreditNoteSchema.safeParse({
      invoice_id: String(formData.get("invoice_id") ?? ""),
      issue_date: String(formData.get("issue_date") ?? ""),
      reason: String(formData.get("reason") ?? "").trim(),
      amount_before_vat: formData.get("amount_before_vat"),
      vat_affected:
        formData.get("vat_affected") === "on" ||
        formData.get("vat_affected") === "true",
      notes: String(formData.get("notes") ?? "").trim() || null,
    });
    if (!parsed.success) {
      return {
        ok: false,
        message:
          parsed.error.issues[0]?.message ??
          "Invoice, date, reason, and amount are required.",
      };
    }

    const {
      invoice_id,
      issue_date,
      reason,
      amount_before_vat,
      vat_affected,
      notes,
    } = parsed.data;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        "id, client_id, campaign_header_id, currency, subtotal, tax_amount, revenue_before_vat, revenue_vat_amount, status"
      )
      .eq("id", invoice_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return { ok: false, message: "Invoice not found." };
    }

    const sourceRevenue = Number(invoice.revenue_before_vat ?? invoice.subtotal ?? 0);
    const sourceVat = Number(invoice.revenue_vat_amount ?? invoice.tax_amount ?? 0);

    if (amount_before_vat > sourceRevenue) {
      return {
        ok: false,
        message: "Credit note amount cannot exceed invoice revenue before VAT.",
      };
    }

    const vat = computeAdjustmentVatAmounts({
      amount_before_vat,
      source_revenue_before_vat: sourceRevenue,
      source_vat_amount: sourceVat,
      vat_affected,
    });

    const { data: created, error: insertError } = await supabase
      .from("client_credit_notes")
      .insert({
        invoice_id,
        client_id: invoice.client_id,
        campaign_header_id: invoice.campaign_header_id,
        issue_date,
        reason,
        amount_before_vat: vat.amount_before_vat,
        vat_affected,
        vat_amount: vat.vat_amount,
        amount_after_vat: vat.amount_after_vat,
        currency: invoice.currency,
        notes,
        status: "draft",
        created_by: user.id,
      })
      .select("id, document_number")
      .single();

    const createdRow = created as { id: string; document_number: string } | null;

    if (insertError || !createdRow) {
      return { ok: false, message: insertError?.message ?? "Failed to create credit note." };
    }

    const { data: cnRegistry } = await supabase
      .from("finance_documents")
      .insert({
        document_kind: "client_credit_note",
        document_number: createdRow.document_number,
        source_table: "client_credit_notes",
        source_id: createdRow.id,
        client_id: invoice.client_id,
        campaign_header_id: invoice.campaign_header_id,
        currency: invoice.currency,
        amount_before_vat: vat.amount_before_vat,
        vat_amount: vat.vat_amount,
        amount_after_vat: vat.amount_after_vat,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    const { data: invoiceRegistry } = await supabase
      .from("finance_documents")
      .select("id")
      .eq("source_table", "invoices")
      .eq("source_id", invoice_id)
      .maybeSingle();

    if (cnRegistry?.id && invoiceRegistry?.id) {
      await supabase.from("finance_document_links").insert({
        link_type: "adjustment_to_invoice",
        source_document_id: cnRegistry.id,
        target_document_id: invoiceRegistry.id,
      });
    }

    await logFinanceAuditEvent(baseClient, {
      event: FINANCE_AUDIT_EVENTS.cn_created,
      entity_type: "client_credit_note",
      entity_id: createdRow.id,
      actor_id: user.id,
      payload: { invoice_id, amount_after_vat: vat.amount_after_vat },
    });

    revalidatePath("/finance/client-credit-notes");
    revalidatePath("/finance/invoices");

    return {
      ok: true,
      message: `Credit note ${createdRow.document_number} created as draft.`,
      document_number: createdRow.document_number,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}
