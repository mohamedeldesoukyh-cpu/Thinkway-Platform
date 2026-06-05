/**
 * Campaign line operational + billing invariants (DB CHECK constraints mirrored in app).
 */

export type CampaignLineStatusSnapshot = {
  billing_status: string;
  operational_status: string;
  invoice_id: string | null;
  vendor_io_id?: string | null;
  finance_override_until?: string | null;
};

const HEADER_INVOICED_BILLING = new Set(["invoiced", "paid", "closed"]);

export function getCampaignLineStatusViolations(
  line: CampaignLineStatusSnapshot
): string[] {
  const violations: string[] = [];

  if (HEADER_INVOICED_BILLING.has(line.billing_status) && !line.invoice_id) {
    violations.push(
      `billing_status=${line.billing_status} requires invoice_id (got null)`
    );
  }

  if (line.operational_status === "reopened" && line.invoice_id) {
    violations.push("operational_status=reopened cannot have invoice_id");
  }

  if (
    line.operational_status === "reopened" &&
    !line.invoice_id &&
    line.billing_status === "invoiced" &&
    !hasActiveFinanceOverride(line.finance_override_until) &&
    line.vendor_io_id
  ) {
    violations.push(
      "operational_status=reopened with billing_status=invoiced and vendor_io_id (post-revise invalid)"
    );
  }

  return violations;
}

export function isCampaignLineStatusValid(line: CampaignLineStatusSnapshot): boolean {
  return getCampaignLineStatusViolations(line).length === 0;
}

function hasActiveFinanceOverride(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

/**
 * Repairs invalid pairs before persisting to campaign_lines.
 */
export function repairCampaignLineStatusPatch(
  line: CampaignLineStatusSnapshot,
  proposed: Record<string, string | null> = {}
): Record<string, string | null> {
  const merged: CampaignLineStatusSnapshot = {
    billing_status: String(proposed.billing_status ?? line.billing_status),
    operational_status: String(proposed.operational_status ?? line.operational_status),
    invoice_id:
      proposed.invoice_id !== undefined ? proposed.invoice_id : line.invoice_id,
    vendor_io_id:
      proposed.vendor_io_id !== undefined
        ? proposed.vendor_io_id
        : (line.vendor_io_id ?? null),
    finance_override_until:
      proposed.finance_override_until !== undefined
        ? (proposed.finance_override_until as string | null)
        : (line.finance_override_until ?? null),
  };

  const patch: Record<string, string | null> = { ...proposed };

  if (HEADER_INVOICED_BILLING.has(merged.billing_status) && !merged.invoice_id) {
    patch.billing_status = merged.vendor_io_id ? "moved_to_billing" : "approved";
    if (merged.operational_status === "reopened") {
      patch.operational_status = merged.vendor_io_id ? "io_generated" : "draft";
    }
  }

  if (merged.operational_status === "reopened" && merged.invoice_id) {
    patch.invoice_id = null;
    if (merged.vendor_io_id) {
      patch.operational_status = "io_generated";
    }
  }

  if (
    merged.operational_status === "reopened" &&
    !hasActiveFinanceOverride(merged.finance_override_until) &&
    merged.vendor_io_id &&
    !merged.invoice_id &&
    (patch.billing_status === "invoiced" || merged.billing_status === "invoiced")
  ) {
    patch.billing_status = "moved_to_billing";
    patch.operational_status = "io_generated";
  }

  return patch;
}
