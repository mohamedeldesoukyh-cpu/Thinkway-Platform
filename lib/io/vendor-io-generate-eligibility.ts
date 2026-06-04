const BLOCKED_BILLING_FOR_VIO = new Set([
  "invoiced",
  "partially_paid",
  "paid",
  "closed",
]);

const BLOCKED_OPERATIONAL_FOR_VIO = new Set([
  "invoiced",
  "partially_invoiced",
  "closed",
]);

export type VendorIoGenerateLineSnapshot = {
  vendor_io_id?: string | null;
  invoice_id?: string | null;
  billing_status?: string | null;
  operational_status?: string | null;
  /** Linked creator on the line (required to batch VIO). */
  influencer_id?: string | null;
  campaign_influencer_id?: string | null;
};

/** True when a manual Vendor IO can be generated for this assignment line. */
export function isLineVendorIoGenerateEligible(
  line: VendorIoGenerateLineSnapshot
): boolean {
  if (!line.influencer_id && !line.campaign_influencer_id) return false;
  if (line.vendor_io_id) return false;
  if (line.invoice_id) return false;

  const billing = line.billing_status ?? "draft";
  if (BLOCKED_BILLING_FOR_VIO.has(billing)) return false;

  const operational = line.operational_status ?? "draft";
  if (BLOCKED_OPERATIONAL_FOR_VIO.has(operational)) return false;

  return true;
}
