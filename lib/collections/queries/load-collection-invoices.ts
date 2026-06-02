import type { SupabaseClient } from "@supabase/supabase-js";

import { ageInvoices } from "@/lib/collections/aging";
import type { AgedInvoiceInput } from "@/lib/collections/aging";
import { devLog } from "@/lib/platform/logger";

export type CollectionInvoiceRow = AgedInvoiceInput & {
  outstanding: number;
  aging_bucket: ReturnType<typeof ageInvoices>[number]["aging_bucket"];
  days_past_due: number;
  status: string;
  collection_status: string;
};

export async function loadCollectionInvoices(
  supabase: SupabaseClient,
  options: { clientId?: string; limit?: number } = {}
): Promise<CollectionInvoiceRow[]> {
  let query = supabase
    .from("invoices")
    .select(
      `
      id, document_number, client_id, campaign_header_id, status, collection_status,
      issue_date, due_date, total, amount_paid, currency,
      client:clients(id, name),
      campaign:campaign_headers(id, name)
    `
    )
    .neq("status", "void")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (options.clientId) {
    query = query.eq("client_id", options.clientId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const inputs: AgedInvoiceInput[] = (data ?? []).map((row) => {
    const inv = row as unknown as {
      id: string;
      document_number: string;
      client_id: string;
      campaign_header_id: string | null;
      total: number;
      amount_paid: number;
      currency: string;
      due_date: string | null;
      issue_date: string;
      client: { name: string } | { name: string }[] | null;
      campaign: { name: string } | { name: string }[] | null;
    };
    const clientRel = Array.isArray(inv.client) ? inv.client[0] : inv.client;
    const campaignRel = Array.isArray(inv.campaign) ? inv.campaign[0] : inv.campaign;
    return {
      id: inv.id,
      document_number: inv.document_number,
      client_id: inv.client_id,
      client_name: clientRel?.name ?? "",
      campaign_header_id: inv.campaign_header_id,
      campaign_name: campaignRel?.name ?? null,
      currency: inv.currency,
      due_date: inv.due_date,
      issue_date: inv.issue_date,
      total: Number(inv.total),
      amount_paid: Number(inv.amount_paid),
    };
  });

  const aged = ageInvoices(inputs);

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] invoices loaded", { count: aged.length });
  }

  return aged.map((row) => {
    const src = (data ?? []).find((d) => (d as unknown as { id: string }).id === row.id) as
      | { status: string; collection_status: string }
      | undefined;
    return {
      ...row,
      status: src?.status ?? "sent",
      collection_status: src?.collection_status ?? "pending",
    };
  });
}
