import { loadStatementCampaignLabels } from "@/lib/reports/statements/campaign-label";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import {
  applyRunningBalance,
  sortLedgerLines,
  summarizeLedger,
  type RawLedgerLine,
} from "@/lib/reports/statements/ledger-utils";
import type { StatementLedgerLine } from "@/lib/reports/statements/statement-types";

export type ClientStatementLedgerResult = {
  entity_name: string;
  entity_code: string | null;
  group_name: string | null;
  entity_address: string | null;
  entity_tax_id: string | null;
  currency: string;
  lines: StatementLedgerLine[];
  history_lines: StatementLedgerLine[];
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
    .select("id, name, document_number, billing_address, tax_id, group:groups(name)")
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

  const campaignLabels = await loadStatementCampaignLabels(supabase, invoices);
  const rawLines: RawLedgerLine[] = [];

  for (const invoice of invoices) {
    const date = resolveInvoiceDate(invoice.issue_date);
    if (!date) continue;
    rawLines.push({
      date,
      document_number: invoice.document_number ?? invoice.id,
      campaign_name: campaignLabels.get(invoice.id) ?? invoice.campaign_name ?? null,
      due_date: invoice.due_date,
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
      campaign_name: (row.invoice_id ? campaignLabels.get(row.invoice_id) : null) ?? campaign?.name ?? null,
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
  const history_lines = applyRunningBalance(sorted, "ar");
  const lines = history_lines.filter(line => (!options.fromDate || line.date >= options.fromDate) && (!options.toDate || line.date <= options.toDate));

  const clientRow = client as {
    name: string;
    billing_address?: Record<string, unknown> | string | null;
    tax_id?: string | null;
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
    entity_address: typeof clientRow.billing_address === "string" ? clientRow.billing_address : clientRow.billing_address ? ["line1", "line2", "city", "state", "postal_code", "country"].map(key => clientRow.billing_address && typeof clientRow.billing_address === "object" ? clientRow.billing_address[key] : null).filter(value => typeof value === "string" && value.trim()).join(", ") || null : null,
    entity_tax_id: clientRow.tax_id ?? null,
    currency,
    lines,
    history_lines,
    totals: { ...summarizeLedger(lines), closing_balance: history_lines.filter(line => !options.toDate || line.date <= options.toDate).at(-1)?.balance ?? 0 },
  };
}
