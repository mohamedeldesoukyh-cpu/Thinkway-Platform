import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";

import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase };
}

function resolveLockedStatus(input: {
  is_operational_locked?: boolean | null;
  regeneration_status?: string | null;
}): string {
  if (input.is_operational_locked) return "Locked";
  if (input.regeneration_status === "pending_regeneration") return "Pending regeneration";
  return "Open";
}

const ACTIVE_REGISTER_STATUSES = new Set([
  "draft",
  "sent",
  "partial",
  "partially_paid",
  "paid",
]);

export async function getFinanceInvoiceRegister(options?: {
  campaignHeaderId?: string;
}): Promise<FinanceInvoiceRegisterRow[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("invoices")
    .select(
      `
      id,
      document_number,
      status,
      regeneration_status,
      is_operational_locked,
      issue_date,
      currency,
      subtotal,
      tax_amount,
      total,
      revenue_before_vat,
      revenue_vat_amount,
      revenue_after_vat,
      client:clients(name),
      campaign:${REL.invoices.campaignHeader}(
        name,
        document_number,
        brand:brands(name)
      )
    `
    )
    .not("status", "eq", "void")
    .not("status", "eq", "cancelled")
    .order("issue_date", { ascending: false })
    .limit(500);

  if (options?.campaignHeaderId) {
    query = query.eq("campaign_header_id", options.campaignHeaderId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const rows: FinanceInvoiceRegisterRow[] = [];

  for (const raw of data ?? []) {
    const inv = raw as unknown as {
      id: string;
      document_number: string;
      status: string;
      regeneration_status: string | null;
      is_operational_locked?: boolean | null;
      issue_date: string;
      currency: string;
      subtotal?: number | null;
      tax_amount?: number | null;
      total?: number | null;
      revenue_before_vat?: number | null;
      revenue_vat_amount?: number | null;
      revenue_after_vat?: number | null;
      client: { name: string } | null;
      campaign: {
        name: string;
        document_number: string;
        brand: { name: string } | null;
      } | null;
    };

    if (!ACTIVE_REGISTER_STATUSES.has(inv.status)) continue;
    if (seen.has(inv.id)) continue;
    seen.add(inv.id);

    const revenue_before_vat = Number(
      inv.revenue_before_vat ?? inv.subtotal ?? 0
    );
    const vat_amount = Number(inv.revenue_vat_amount ?? inv.tax_amount ?? 0);
    const revenue_after_vat = Number(
      inv.revenue_after_vat ?? inv.total ?? revenue_before_vat + vat_amount
    );

    rows.push({
      id: inv.id,
      document_number: inv.document_number,
      client_name: inv.client?.name ?? "—",
      brand_name: inv.campaign?.brand?.name ?? null,
      campaign_name: inv.campaign?.name ?? null,
      campaign_document_number: inv.campaign?.document_number ?? null,
      revenue_before_vat,
      vat_amount,
      revenue_after_vat,
      status: inv.status,
      locked_status: resolveLockedStatus(inv),
      created_date: inv.issue_date,
      currency: inv.currency,
      regeneration_status: inv.regeneration_status,
      is_operational_locked: inv.is_operational_locked ?? false,
    } satisfies FinanceInvoiceRegisterRow);
  }

  return rows;
}
