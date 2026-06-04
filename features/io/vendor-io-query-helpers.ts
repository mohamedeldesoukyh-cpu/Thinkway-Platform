import {
  vendorIoUngenerateEligibility,
  type VendorIoLineBillingSnapshot,
} from "@/lib/io/vendor-io-ungenerate-eligibility";
import type { VendorIoRow } from "@/features/io/types";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

export async function attachVendorIoUngenerateEligibility(
  supabase: SupabaseClient,
  rows: VendorIoRow[]
): Promise<VendorIoRow[]> {
  if (rows.length === 0) return rows;

  const vendorIoIds = rows.map((r) => r.id);
  const snapshotsByVio = new Map<string, VendorIoLineBillingSnapshot[]>();

  const { data: directLines } = await supabase
    .from("campaign_lines")
    .select("vendor_io_id, operational_status, invoice_id, billing_status")
    .in("vendor_io_id", vendorIoIds);

  for (const row of directLines ?? []) {
    const typed = row as VendorIoLineBillingSnapshot & { vendor_io_id: string };
    const list = snapshotsByVio.get(typed.vendor_io_id) ?? [];
    list.push({
      operational_status: typed.operational_status,
      invoice_id: typed.invoice_id,
      billing_status: typed.billing_status,
    });
    snapshotsByVio.set(typed.vendor_io_id, list);
  }

  const { data: joinRows } = await supabase
    .from("vendor_io_lines")
    .select(
      "vendor_io_id, campaign_line:campaign_lines(operational_status, invoice_id, billing_status)"
    )
    .in("vendor_io_id", vendorIoIds);

  for (const join of joinRows ?? []) {
    const typed = join as {
      vendor_io_id: string;
      campaign_line: VendorIoLineBillingSnapshot | null;
    };
    if (!typed.campaign_line) continue;
    const list = snapshotsByVio.get(typed.vendor_io_id) ?? [];
    list.push(typed.campaign_line);
    snapshotsByVio.set(typed.vendor_io_id, list);
  }

  return rows.map((row) => {
    const eligibility = vendorIoUngenerateEligibility(snapshotsByVio.get(row.id) ?? []);
    return {
      ...row,
      ungenerate_eligible: eligibility.eligible,
      ungenerate_ineligible_reason: eligibility.reason,
    };
  });
}
