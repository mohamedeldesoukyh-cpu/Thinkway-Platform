import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAgingSummary, ageInvoices } from "@/lib/collections/aging";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { devLog } from "@/lib/platform/logger";

/** PDF/export-ready client AR statement structure (data only). */
export type ClientStatementPayload = {
  client_id: string;
  client_name: string;
  generated_at: string;
  currency: string;
  summary: {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    overdue_amount: number;
  };
  aging_buckets: ReturnType<typeof buildAgingSummary>["buckets"];
  invoices: {
    document_number: string;
    issue_date: string;
    due_date: string | null;
    total: number;
    amount_paid: number;
    outstanding: number;
    aging_bucket: string;
    collection_status: string;
  }[];
  payments: {
    document_number: string;
    amount: number;
    paid_at: string | null;
    reference_number: string | null;
  }[];
};

export async function loadClientStatement(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientStatementPayload | null> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) return null;

  const invoices = await loadCollectionInvoices(supabase, { clientId });
  const aged = ageInvoices(invoices);
  const aging = buildAgingSummary(invoices);

  const { data: payments } = await supabase
    .from("payments")
    .select("document_number, amount, paid_at, reference_number, invoice_id")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("paid_at", { ascending: false })
    .limit(100);

  const currency = invoices[0]?.currency ?? "USD";
  const total_invoiced = roundMoney(invoices.reduce((s, i) => s + Number(i.total), 0));
  const total_collected = roundMoney(
    invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  );

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] client statement", { clientId, invoices: invoices.length });
  }

  return {
    client_id: client.id,
    client_name: client.name,
    generated_at: new Date().toISOString(),
    currency,
    summary: {
      total_invoiced,
      total_collected,
      total_outstanding: aging.total_outstanding,
      overdue_amount: aging.overdue_amount,
    },
    aging_buckets: aging.buckets,
    invoices: aged.map((inv) => ({
      document_number: inv.document_number ?? inv.id,
      issue_date: inv.issue_date ?? "",
      due_date: inv.due_date,
      total: inv.total,
      amount_paid: inv.amount_paid,
      outstanding: inv.outstanding,
      aging_bucket: inv.aging_bucket,
      collection_status: inv.collection_status ?? "pending",
    })),
    payments: (payments ?? []).map((p) => ({
      document_number: (p as { document_number: string }).document_number,
      amount: Number((p as { amount: number }).amount),
      paid_at: (p as { paid_at: string | null }).paid_at,
      reference_number: (p as { reference_number: string | null }).reference_number,
    })),
  };
}
