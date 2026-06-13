import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyRunningBalance,
  filterLinesByDateRange,
  sortLedgerLines,
  summarizeLedger,
  type RawLedgerLine,
} from "@/lib/reports/statements/ledger-utils";
import type { StatementLedgerLine } from "@/lib/reports/statements/statement-types";

const EXCLUDED_VENDOR_IO_STATUSES = ["draft", "rejected", "cancelled"];

export type VendorStatementLedgerResult = {
  entity_name: string;
  entity_code: string | null;
  currency: string;
  lines: StatementLedgerLine[];
  totals: ReturnType<typeof summarizeLedger>;
};

function resolveVendorIoDate(row: {
  document_generated_at: string | null;
  approved_at: string | null;
  created_at: string;
}): string {
  const source = row.document_generated_at ?? row.approved_at ?? row.created_at;
  return source?.slice(0, 10) ?? "";
}

function resolveVendorPaymentDate(
  vendorPaidAt: string | null,
  batchDate: string | null | undefined
): string {
  const source = vendorPaidAt ?? batchDate;
  return source?.slice(0, 10) ?? "";
}

export async function loadVendorStatementLedger(
  supabase: SupabaseClient,
  vendorId: string,
  options: { fromDate?: string | null; toDate?: string | null } = {}
): Promise<VendorStatementLedgerResult | null> {
  const { data: vendor, error: vendorError } = await supabase
    .from("influencers")
    .select("id, display_name, legal_name, document_number")
    .eq("id", vendorId)
    .maybeSingle();

  if (vendorError || !vendor) return null;

  const { data: vendorIos, error: vendorIoError } = await supabase
    .from("vendor_ios")
    .select(
      `
      id, document_number, amount, currency_code, status,
      document_generated_at, approved_at, created_at,
      campaign:campaign_headers(name)
    `
    )
    .eq("influencer_id", vendorId)
    .eq("is_superseded", false)
    .not("status", "in", `(${EXCLUDED_VENDOR_IO_STATUSES.join(",")})`)
    .order("created_at", { ascending: true });

  if (vendorIoError) throw new Error(vendorIoError.message);

  const { data: paidAssignments, error: assignmentsError } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id, agreed_fee, currency, vendor_paid_at, payment_batch_id,
      campaign:campaign_headers(name),
      batch:vendor_payment_batches(document_number, batch_date)
    `
    )
    .eq("influencer_id", vendorId)
    .eq("vendor_payment_status", "paid")
    .not("vendor_paid_at", "is", null)
    .order("vendor_paid_at", { ascending: true });

  if (assignmentsError) throw new Error(assignmentsError.message);

  const rawLines: RawLedgerLine[] = [];

  for (const vendorIo of vendorIos ?? []) {
    const row = vendorIo as unknown as {
      id: string;
      document_number: string | null;
      amount: number;
      currency_code: string;
      document_generated_at: string | null;
      approved_at: string | null;
      created_at: string;
      campaign: { name: string } | { name: string }[] | null;
    };

    const date = resolveVendorIoDate(row);
    if (!date) continue;

    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;

    rawLines.push({
      date,
      document_number: row.document_number ?? row.id,
      campaign_name: campaign?.name ?? null,
      debit: 0,
      credit: Number(row.amount),
      currency: row.currency_code,
      kind: "vendor_io",
    });
  }

  for (const assignment of paidAssignments ?? []) {
    const row = assignment as unknown as {
      id: string;
      agreed_fee: number;
      currency: string;
      vendor_paid_at: string | null;
      campaign: { name: string } | { name: string }[] | null;
      batch:
        | { document_number: string; batch_date: string }
        | { document_number: string; batch_date: string }[]
        | null;
    };

    const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
    const date = resolveVendorPaymentDate(row.vendor_paid_at, batch?.batch_date);
    if (!date) continue;

    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;

    rawLines.push({
      date,
      document_number: batch?.document_number ?? row.id,
      campaign_name: campaign?.name ?? null,
      debit: Number(row.agreed_fee),
      credit: 0,
      currency: row.currency,
      kind: "vendor_payment",
    });
  }

  const typedVendor = vendor as {
    display_name: string | null;
    legal_name: string | null;
    document_number: string | null;
  };
  const currency =
    (vendorIos?.[0] as { currency_code?: string } | undefined)?.currency_code ??
    (paidAssignments?.[0] as { currency?: string } | undefined)?.currency ??
    "USD";

  const sorted = sortLedgerLines(rawLines);
  const filtered = filterLinesByDateRange(
    sorted,
    options.fromDate ?? null,
    options.toDate ?? null
  );
  const lines = applyRunningBalance(filtered, "ap");

  return {
    entity_name:
      typedVendor.display_name?.trim() || typedVendor.legal_name?.trim() || "Vendor",
    entity_code: typedVendor.document_number,
    currency,
    lines,
    totals: summarizeLedger(lines),
  };
}
