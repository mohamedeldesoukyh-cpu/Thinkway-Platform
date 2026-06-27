import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/operational-utils";
import { canRegenerateInvoice } from "@/lib/billing/regeneration-eligibility";
import { hasExistingIoCoverage } from "@/lib/operations/io-coverage";

export type LineInvoiceEligibilityInput = {
  operational_status?: CampaignLineOperationalStatus | string | null;
  vendor_io_id?: string | null;
  active_vendor_io_id?: string | null;
  vendor_io_document_number?: string | null;
  is_locked?: boolean;
  remaining_amount?: number;
  billing_status?: string | null;
  invoice_id?: string | null;
  billable_amount?: number;
  invoiced_amount?: number;
};

export function isLineInvoiceEligible(line: LineInvoiceEligibilityInput): boolean {
  return canRegenerateInvoice({
    billing_status: line.billing_status,
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    active_vendor_io_id: line.active_vendor_io_id,
    vendor_io_document_number: line.vendor_io_document_number,
    invoice_id: line.invoice_id,
    remaining_amount: line.remaining_amount,
    billable_amount: line.billable_amount,
    invoiced_amount: line.invoiced_amount,
  });
}

export function blockInvoiceWithoutVendorIoMessage(): string {
  return "Generate Vendor IO for new assignments or deliverables before invoicing.";
}

export function lineNeverHadVendorIo(line: LineInvoiceEligibilityInput): boolean {
  return !hasExistingIoCoverage({
    vendor_io_id: line.vendor_io_id,
    active_vendor_io_id: line.active_vendor_io_id,
    vendor_io_document_number: line.vendor_io_document_number,
  });
}
