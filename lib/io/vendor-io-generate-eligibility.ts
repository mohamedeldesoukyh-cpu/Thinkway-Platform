export type VendorIoGenerateLineSnapshot = {
  vendor_payment_locked?: boolean;
  vendor_io_id?: string | null;
  /** Resolved active Vendor IO — null means no active link (orphan/superseded-only). */
  active_vendor_io_id?: string | null;
  invoice_id?: string | null;
  billing_status?: string | null;
  operational_status?: string | null;
  influencer_id?: string | null;
  campaign_influencer_id?: string | null;
};

export type VendorIoGenerateEligibility = {
  eligible: boolean;
  reason: string;
};

function hasActiveVendorIoLink(line: VendorIoGenerateLineSnapshot): boolean {
  if (line.active_vendor_io_id !== undefined) {
    return Boolean(line.active_vendor_io_id);
  }
  return Boolean(line.vendor_io_id);
}

/** Explain why a line can or cannot receive a new Vendor IO. */
export function explainVendorIoGenerateEligibility(
  line: VendorIoGenerateLineSnapshot
): VendorIoGenerateEligibility {
  if (!line.influencer_id && !line.campaign_influencer_id) {
    return { eligible: false, reason: "No creator assigned on this line." };
  }

  if (hasActiveVendorIoLink(line)) {
    return { eligible: false, reason: "An active Vendor IO is already linked." };
  }

  if (line.vendor_payment_locked) {
    return { eligible: false, reason: "Vendor payment is recorded. Set the payment to zero before changing Vendor IOs." };
  }

  return { eligible: true, reason: "eligible" };
}

/** True when a manual Vendor IO can be generated for this assignment line. */
export function isLineVendorIoGenerateEligible(
  line: VendorIoGenerateLineSnapshot
): boolean {
  return explainVendorIoGenerateEligibility(line).eligible;
}

export function logVendorIoEligibility(
  lineId: string,
  line: VendorIoGenerateLineSnapshot
): void {
  const { eligible, reason } = explainVendorIoGenerateEligibility(line);
  console.info("[vendor-io-eligibility]", {
    line_id: lineId,
    vendor_io_id: line.vendor_io_id ?? null,
    active_vendor_io_id: line.active_vendor_io_id ?? null,
    invoice_id: line.invoice_id ?? null,
    operational_status: line.operational_status ?? "draft",
    billing_status: line.billing_status ?? "draft",
    eligible,
    reason,
  });
}
