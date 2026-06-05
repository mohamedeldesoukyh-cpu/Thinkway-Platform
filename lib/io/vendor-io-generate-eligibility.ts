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

  if (line.invoice_id) {
    return { eligible: false, reason: "Assignment is linked to a client invoice." };
  }

  const billing = line.billing_status ?? "draft";
  if (billing === "closed") {
    return { eligible: false, reason: "Assignment billing is closed." };
  }
  if (BLOCKED_BILLING_FOR_VIO.has(billing)) {
    return {
      eligible: false,
      reason: `Billing status "${billing}" blocks Vendor IO generation.`,
    };
  }

  const operational = line.operational_status ?? "draft";
  if (operational === "closed") {
    return { eligible: false, reason: "Assignment operational status is closed." };
  }
  if (BLOCKED_OPERATIONAL_FOR_VIO.has(operational)) {
    return {
      eligible: false,
      reason: `Operational status "${operational}" blocks Vendor IO generation.`,
    };
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
