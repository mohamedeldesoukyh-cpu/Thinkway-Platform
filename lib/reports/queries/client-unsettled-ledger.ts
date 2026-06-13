import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import {
  applyRunningBalance,
  sortLedgerLines,
  summarizeLedger,
  type RawLedgerLine,
} from "@/lib/reports/statements/ledger-utils";
import type { StatementLedgerLine } from "@/lib/reports/statements/statement-types";

export type ClientUnsettledLedgerResult = {
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

export async function loadClientUnsettledLedger(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientUnsettledLedgerResult | null> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, document_number, group:groups(name)")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) return null;

  const invoices = await loadCollectionInvoices(supabase, { clientId });
  const rawLines: RawLedgerLine[] = [];

  for (const invoice of invoices) {
    if (invoice.outstanding <= 0) continue;

    const date = resolveInvoiceDate(invoice.issue_date);
    if (!date) continue;

    rawLines.push({
      date,
      document_number: invoice.document_number ?? invoice.id,
      campaign_name: invoice.campaign_name ?? null,
      debit: invoice.outstanding,
      credit: 0,
      currency: invoice.currency,
      kind: "invoice",
    });
  }

  const currency = invoices[0]?.currency ?? "USD";
  const sorted = sortLedgerLines(rawLines);
  const lines = applyRunningBalance(sorted, "ar");

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
