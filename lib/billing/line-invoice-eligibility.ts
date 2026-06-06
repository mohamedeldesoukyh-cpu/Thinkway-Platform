import { effectiveLineOperationalStatus } from "@/lib/campaigns/effective-operational-status";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { isInvoiceEligibleOperationalStatus } from "@/features/campaigns/types/operational";
import {
  getRemainingRevenue,
  isFullyInvoicedBillingStatus,
  isPartiallyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";

export type LineInvoiceEligibilityInput = {
  operational_status?: CampaignLineOperationalStatus | string | null;
  vendor_io_id?: string | null;
  is_locked?: boolean;
  remaining_amount?: number;
  billing_status?: string | null;
  invoice_id?: string | null;
  billable_amount?: number;
  invoiced_amount?: number;
};

export function isLineInvoiceEligible(line: LineInvoiceEligibilityInput): boolean {
  if (!line.vendor_io_id) return false;

  const billing = line.billing_status ?? "";
  if (isFullyInvoicedBillingStatus(billing)) return false;

  const remaining = getRemainingRevenue({
    remaining_amount: line.remaining_amount,
  });

  if (isPartiallyInvoicedBillingStatus(billing)) {
    return remaining > 0;
  }

  if (line.is_locked && remaining <= 0) return false;

  const status = effectiveLineOperationalStatus({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: line.billing_status,
    invoice_id: line.invoice_id,
    remaining_amount: remaining,
    billable_amount: line.billable_amount,
    invoiced_amount: line.invoiced_amount,
    revenue_locked: line.is_locked,
  }) as CampaignLineOperationalStatus;

  if (status === "locked") return false;
  if (remaining <= 0) return false;

  return isInvoiceEligibleOperationalStatus(status);
}

export function blockInvoiceWithoutVendorIoMessage(): string {
  return "Generate Vendor IO for selected assignment lines before invoicing.";
}
