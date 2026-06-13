import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import {
  applyRunningBalance,
  filterLinesByDateRange,
  sortLedgerLines,
  summarizeLedger,
  type RawLedgerLine,
} from "@/lib/reports/statements/ledger-utils";
import type { StatementLedgerLine } from "@/lib/reports/statements/statement-types";

export type ClientStatementLedgerResult = {
  entity_name: string;
  entity_code: string | null;
  group_name: string | null;
  currency: string;
  lines: StatementLedgerLine[];
  totals: ReturnType<typeof summarizeLedger>;
};

function resolveInvoiceDate(issueDate: string | null | undefined): string {
  if (issueDate?.trim()) return issueDate.slice(0, 10);
  return "";
}

function resolvePaymentDate(paidAt: string | null | undefined): string {
  if (paidAt?.trim()) return paidAt.slice(0, 10);
  return "";
}

export async function loadClientStatementLedger(
  supabase: SupabaseClient,
  clientId: string,
  options: { fromDate?: string | null; toDate?: string | null } = {}
): Promise<ClientStatementLedgerResult | null> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, document_number, group:groups(name)")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) return null;

  const invoices = await loadCollectionInvoices(supabase, { clientId });

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(
      `
      id, document_number, amount, paid_at, currency, invoice_id,
      invoice:invoices(
        campaign:campaign_headers(name)
      )
    `
    )
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("paid_at", { ascending: true });

  if (paymentsError) throw new Error(paymentsError.message);

  const rawLines: RawLedgerLine[] = [];

  for (const invoice of invoices) {
    const date = resolveInvoiceDate(invoice.issue_date);
    if (!date) continue;
    rawLines.push({
      date,
      document_number: invoice.document_number ?? invoice.id,
      campaign_name: invoice.campaign_name ?? null,
      debit: invoice.total,
      credit: 0,
      currency: invoice.currency,
      kind: "invoice",
    });
  }

  for (const payment of payments ?? []) {
    const row = payment as unknown as {
      id: string;
      document_number: string;
      amount: number;
      paid_at: string | null;
      currency: string;
      invoice_id: string | null;
      invoice:
        | {
            campaign: { name: string } | { name: string }[] | null;
          }
        | {
            campaign: { name: string } | { name: string }[] | null;
          }[]
        | null;
    };

    const date = resolvePaymentDate(row.paid_at);
    if (!date) continue;

    const invoiceRel = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
    const campaignRel = invoiceRel?.campaign;
    const campaign = Array.isArray(campaignRel) ? campaignRel[0] : campaignRel;

    rawLines.push({
      date,
      document_number: row.document_number || row.id,
      campaign_name: campaign?.name ?? null,
      debit: 0,
      credit: Number(row.amount),
      currency: row.currency,
      kind: "payment",
    });
  }

  const currency =
    invoices[0]?.currency ??
    (payments?.[0] as { currency?: string } | undefined)?.currency ??
    "USD";

  const sorted = sortLedgerLines(rawLines);
  const filtered = filterLinesByDateRange(
    sorted,
    options.fromDate ?? null,
    options.toDate ?? null
  );
  const lines = applyRunningBalance(filtered, "ar");

  const clientRow = client as {
    name: string;
    document_number: string | null;
    group?: { name: string } | { name: string }[] | null;
  };
  const groupRel = clientRow.group;
  const group_name = Array.isArray(groupRel)
    ? (groupRel[0]?.name ?? null)
    : (groupRel?.name ?? null);

  return {
    entity_name: clientRow.name,
    entity_code: clientRow.document_number,
    group_name,
    currency,
    lines,
    totals: summarizeLedger(lines),
  };
}
