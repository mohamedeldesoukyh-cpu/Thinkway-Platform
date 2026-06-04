import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { isInvoiceEligibleOperationalStatus } from "@/features/campaigns/types/operational";

export type LineInvoiceEligibilityInput = {
  operational_status?: CampaignLineOperationalStatus | string | null;
  vendor_io_id?: string | null;
  is_locked?: boolean;
  remaining_amount?: number;
  billing_status?: string | null;
};

const BLOCKED_LINE_BILLING = new Set([
  "invoiced",
  "paid",
  "closed",
  "partially_paid",
]);

export function isLineInvoiceEligible(line: LineInvoiceEligibilityInput): boolean {
  if (line.is_locked) return false;
  if (!line.vendor_io_id) return false;

  const billing = line.billing_status ?? "";
  if (BLOCKED_LINE_BILLING.has(billing)) {
    return false;
  }

  const status = (line.operational_status ?? "draft") as CampaignLineOperationalStatus;
  return isInvoiceEligibleOperationalStatus(status);
}

export function blockInvoiceWithoutVendorIoMessage(): string {
  return "Generate Vendor IO for selected assignment lines before invoicing.";
}
