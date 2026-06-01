import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeNetVatPayable } from "@/lib/vat/calculations";

import type {
  VatCountryRow,
  VatEntityRow,
  VatInvoiceRow,
  VatMonthlyRow,
  VatWorkspaceData,
} from "./types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export async function getVatWorkspace(): Promise<VatWorkspaceData> {
  const supabase = await requireUser();

  const [linesResult, invoicesResult] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        `
        revenue_before_vat, revenue_vat_amount, cost_vat_amount,
        header:campaign_headers(
          client:clients(id, name, country)
        )
      `
      )
      .limit(500),
    supabase
      .from("invoices")
      .select(
        `
        id, document_number, issue_date, currency,
        revenue_before_vat, revenue_vat_amount, revenue_after_vat, billing_country_code,
        client:clients(id, name, country)
      `
      )
      .not("status", "eq", "void")
      .order("issue_date", { ascending: false })
      .limit(200),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);

  type LineVatRow = {
    revenue_before_vat?: number;
    revenue_vat_amount?: number;
    cost_vat_amount?: number;
    created_at?: string;
    header?: { client: { id: string; name: string; country: string | null } | null } | null;
  };

  type InvoiceVatRow = {
    id: string;
    document_number: string;
    issue_date: string;
    currency: string;
    revenue_before_vat?: number;
    revenue_vat_amount?: number;
    revenue_after_vat?: number;
    billing_country_code?: string | null;
    client?: { id: string; name: string; country: string | null } | null;
  };

  const lines = (linesResult.data ?? []) as LineVatRow[];
  const invoices = (invoicesResult.data ?? []) as InvoiceVatRow[];

  const revenueBeforeVat = lines.reduce(
    (sum, line) => sum + Number(line.revenue_before_vat ?? 0),
    0
  );
  const outputVatFromLines = lines.reduce(
    (sum, line) => sum + Number(line.revenue_vat_amount ?? 0),
    0
  );
  const inputVat = lines.reduce(
    (sum, line) => sum + Number(line.cost_vat_amount ?? 0),
    0
  );
  const outputVatFromInvoices = invoices.reduce(
    (sum, inv) => sum + Number(inv.revenue_vat_amount ?? 0),
    0
  );
  const outputVat = outputVatFromInvoices > 0 ? outputVatFromInvoices : outputVatFromLines;
  const netVatPayable = computeNetVatPayable(outputVat, inputVat);

  const monthlyMap = new Map<string, VatMonthlyRow>();
  for (const inv of invoices) {
    const key = monthKey(inv.issue_date);
    const row = monthlyMap.get(key) ?? {
      month: key,
      label: monthLabel(key),
      output_vat: 0,
      input_vat: 0,
      net_vat_payable: 0,
      revenue_before_vat: 0,
    };
    row.output_vat += Number(inv.revenue_vat_amount ?? 0);
    row.revenue_before_vat += Number(inv.revenue_before_vat ?? 0);
    monthlyMap.set(key, row);
  }

  for (const line of lines) {
    const createdAt = line.created_at;
    const key = createdAt ? monthKey(createdAt) : monthKey(new Date().toISOString());
    const row = monthlyMap.get(key) ?? {
      month: key,
      label: monthLabel(key),
      output_vat: 0,
      input_vat: 0,
      net_vat_payable: 0,
      revenue_before_vat: 0,
    };
    row.input_vat += Number(line.cost_vat_amount ?? 0);
    monthlyMap.set(key, row);
  }

  const monthly = [...monthlyMap.values()]
    .map((row) => ({
      ...row,
      net_vat_payable: computeNetVatPayable(row.output_vat, row.input_vat),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const countryMap = new Map<string, VatCountryRow>();
  for (const inv of invoices) {
    const client = inv.client;
    const code = (inv.billing_country_code ?? client?.country ?? "—").toUpperCase();
    const row = countryMap.get(code) ?? {
      country_code: code,
      output_vat: 0,
      input_vat: 0,
      net_vat_payable: 0,
    };
    row.output_vat += Number(inv.revenue_vat_amount ?? 0);
    countryMap.set(code, row);
  }

  for (const line of lines) {
    const header = line.header;
    const code = (header?.client?.country ?? "—").toUpperCase();
    const row = countryMap.get(code) ?? {
      country_code: code,
      output_vat: 0,
      input_vat: 0,
      net_vat_payable: 0,
    };
    row.input_vat += Number(line.cost_vat_amount ?? 0);
    countryMap.set(code, row);
  }

  const by_country = [...countryMap.values()].map((row) => ({
    ...row,
    net_vat_payable: computeNetVatPayable(row.output_vat, row.input_vat),
  }));

  const entityMap = new Map<string, VatEntityRow>();
  for (const inv of invoices) {
    const client = inv.client;
    if (!client) continue;
    const row = entityMap.get(client.id) ?? {
      client_id: client.id,
      client_name: client.name,
      country_code: client.country,
      output_vat: 0,
      revenue_before_vat: 0,
    };
    row.output_vat += Number(inv.revenue_vat_amount ?? 0);
    row.revenue_before_vat += Number(inv.revenue_before_vat ?? 0);
    entityMap.set(client.id, row);
  }

  const invoiceRows: VatInvoiceRow[] = invoices.map((inv) => {
    const client = inv.client;
    return {
      id: inv.id,
      document_number: inv.document_number,
      issue_date: inv.issue_date,
      client_name: client?.name ?? "",
      country_code: inv.billing_country_code ?? client?.country ?? null,
      revenue_before_vat: Number(inv.revenue_before_vat ?? 0),
      output_vat: Number(inv.revenue_vat_amount ?? 0),
      total_after_vat: Number(inv.revenue_after_vat ?? 0),
      currency: inv.currency,
    };
  });

  return {
    kpis: {
      revenue_before_vat: revenueBeforeVat,
      output_vat: outputVat,
      input_vat: inputVat,
      net_vat_payable: netVatPayable,
      vat_reclaimable: Math.max(0, inputVat - outputVat),
    },
    monthly,
    by_country,
    by_entity: [...entityMap.values()],
    invoices: invoiceRows,
    include_vat_in_operational: false,
  };
}