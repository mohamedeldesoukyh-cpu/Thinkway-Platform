export type VendorIoLineBillingSnapshot = {
  operational_status: string;
  invoice_id: string | null;
  billing_status: string;
};

export function isLineBlockingVendorIoUngenerate(
  line: VendorIoLineBillingSnapshot
): boolean {
  if (line.invoice_id) return true;
  if (line.operational_status === "invoiced") return true;
  if (line.operational_status === "partially_invoiced") return true;
  return ["invoiced", "paid", "closed"].includes(line.billing_status);
}

export function isLineUngenerateIoEligible(
  line: VendorIoLineBillingSnapshot & { vendor_io_id?: string | null }
): boolean {
  if (!line.vendor_io_id) return false;
  return !isLineBlockingVendorIoUngenerate(line);
}

export function vendorIoUngenerateEligibility(
  lines: VendorIoLineBillingSnapshot[]
): { eligible: boolean; reason: string | null } {
  if (lines.length === 0) {
    return { eligible: false, reason: "No assignment lines linked to this Vendor IO." };
  }
  if (lines.some(isLineBlockingVendorIoUngenerate)) {
    return {
      eligible: false,
      reason: "Cannot un-generate: one or more linked lines are already invoiced.",
    };
  }
  return { eligible: true, reason: null };
}
