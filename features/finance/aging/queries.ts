import type { AgedInvoiceInput } from "@/lib/collections/aging";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import {
  ageInvoicesWithBasis,
  agingBasisForMode,
  AGING_BASIS_LABELS,
  buildClientAgingDetailRows,
  buildClientAgingSummaryRows,
  buildFinanceAgingSummary,
} from "@/lib/finance/aging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AgingReportQuery, AgingWorkspaceData } from "./types";

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseMode(raw: string | undefined): AgingReportQuery["mode"] {
  return raw === "overdue" ? "overdue" : "client";
}

function parseView(raw: string | undefined): AgingReportQuery["view"] {
  return raw === "detailed" ? "detailed" : "summary";
}

export function parseAgingReportSearchParams(
  params: Record<string, string | string[] | undefined>
): AgingReportQuery {
  const clientId = readParam(params, "clientId")?.trim() || null;
  return {
    mode: parseMode(readParam(params, "mode")),
    view: parseView(readParam(params, "view")),
    clientId,
  };
}

async function loadAgingInvoiceInputs(
  clientId?: string | null
): Promise<AgedInvoiceInput[]> {
  const supabase = await createSupabaseServerClient();
  const rows = await loadCollectionInvoices(supabase, {
    clientId: clientId ?? undefined,
  });

  return rows.map((row) => ({
    id: row.id,
    document_number: row.document_number,
    client_id: row.client_id,
    client_name: row.client_name,
    campaign_header_id: row.campaign_header_id,
    campaign_name: row.campaign_name,
    currency: row.currency,
    due_date: row.due_date,
    issue_date: row.issue_date,
    total: row.total,
    amount_paid: row.amount_paid,
  }));
}

export async function getAgingWorkspace(
  query: AgingReportQuery = { mode: "client", view: "summary" }
): Promise<AgingWorkspaceData> {
  const asOf = new Date();
  const basis = agingBasisForMode(query.mode);
  const inputs = await loadAgingInvoiceInputs(query.clientId);
  const aged = ageInvoicesWithBasis(inputs, basis, asOf);
  const openInvoices = aged.filter((inv) => inv.outstanding > 0);

  const currencies = [...new Set(openInvoices.map((inv) => inv.currency))].sort();
  const clientIds = new Set(openInvoices.map((inv) => inv.client_id));

  return {
    mode: query.mode,
    view: query.view,
    basis,
    basis_label: AGING_BASIS_LABELS[basis],
    as_of: asOf.toISOString().slice(0, 10),
    summary: buildFinanceAgingSummary(aged),
    client_rows: buildClientAgingSummaryRows(aged),
    detail_rows: buildClientAgingDetailRows(aged),
    currencies,
    mixed_currency: currencies.length > 1,
    invoice_count: openInvoices.length,
    client_count: clientIds.size,
  };
}
