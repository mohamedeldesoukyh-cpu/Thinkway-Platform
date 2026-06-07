import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveActiveVendorIoId } from "@/lib/io/vendor-io-active-link";
import { resolveVendorIoLineAmount } from "@/lib/io/vendor-io-line-amount";

const MONEY_EPSILON = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function vendorIoAmountDriftsFromLineCost(
  lineCostBeforeVat: number,
  vendorIoAmount: number
): boolean {
  return (
    Math.abs(roundMoney(lineCostBeforeVat) - roundMoney(vendorIoAmount)) > MONEY_EPSILON
  );
}

export function lineCostDriftsFromVendorIoAmount(line: {
  cost_before_vat?: number | null;
  cost?: number | null;
  revenue_before_vat?: number | null;
  revenue?: number | null;
  vendor_io_amount?: number | null;
}): boolean {
  if (line.vendor_io_amount == null) return false;
  const expected = resolveVendorIoLineAmount(line);
  return vendorIoAmountDriftsFromLineCost(expected, Number(line.vendor_io_amount));
}

export type VendorIoAmountDriftRow = {
  line_id: string;
  vendor_io_id: string;
  active_vendor_io_id: string;
  line_cost_before_vat: number;
  vendor_io_amount: number;
};

/**
 * Lines whose active Vendor IO amount no longer matches creator cost (ex-VAT).
 */
export async function findVendorIoAmountDriftForCampaign(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  lineIds?: string[]
): Promise<VendorIoAmountDriftRow[]> {
  let query = supabase
    .from("campaign_lines")
    .select("id, cost_before_vat, cost, revenue_before_vat, revenue, vendor_io_id")
    .eq("campaign_header_id", campaignHeaderId)
    .not("vendor_io_id", "is", null);

  if (lineIds?.length) {
    query = query.in("id", lineIds);
  }

  const { data: lines, error } = await query;
  if (error || !lines?.length) return [];

  type LineRow = {
    id: string;
    cost_before_vat: number | null;
    cost: number | null;
    revenue_before_vat: number | null;
    revenue: number | null;
    vendor_io_id: string | null;
  };

  const driftRows: VendorIoAmountDriftRow[] = [];

  for (const raw of lines as LineRow[]) {
    if (!raw.vendor_io_id) continue;

    const activeVendorIoId = await resolveActiveVendorIoId(supabase, raw.vendor_io_id);
    if (!activeVendorIoId) continue;

    const { data: vio } = await supabase
      .from("vendor_ios")
      .select("amount")
      .eq("id", activeVendorIoId)
      .maybeSingle();

    if (!vio) continue;

    const lineCost = resolveVendorIoLineAmount(raw);
    const vioAmount = Number((vio as { amount: number }).amount);

    if (vendorIoAmountDriftsFromLineCost(lineCost, vioAmount)) {
      driftRows.push({
        line_id: raw.id,
        vendor_io_id: raw.vendor_io_id,
        active_vendor_io_id: activeVendorIoId,
        line_cost_before_vat: lineCost,
        vendor_io_amount: vioAmount,
      });
    }
  }

  return driftRows;
}
