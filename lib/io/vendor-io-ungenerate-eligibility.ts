export type VendorIoLineBillingSnapshot = {
  vendor_payment_locked?: boolean;
  operational_status: string;
  invoice_id: string | null;
  billing_status: string;
  invoice_unlocked?: boolean;
};

export function isLineBlockingVendorIoUngenerate(
  line: VendorIoLineBillingSnapshot
): boolean {
  return line.vendor_payment_locked === true;
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
      reason: "Cannot un-generate: a vendor payment is recorded. Set the payment to zero first.",
    };
  }
  return { eligible: true, reason: null };
}
