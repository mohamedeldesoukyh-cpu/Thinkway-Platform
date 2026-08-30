import type { CreatorPaymentRow } from "@/features/portals/types";

export function creatorPaymentExplanation(input: {
  paymentStatus: string;
  vendorPaymentStatus?: string | null;
  vendorIoStatus?: string | null;
  pendingDeliverables?: number;
}): string {
  const status = input.paymentStatus.trim().toLowerCase();
  if (status === "paid") {
    return "This fee has been paid.";
  }
  if (input.vendorIoStatus === "sent") {
    return "Waiting for you to accept the agreement.";
  }
  if ((input.pendingDeliverables ?? 0) > 0) {
    return "Waiting for campaign completion.";
  }
  if (status === "invoiced" || status === "partially paid") {
    return "Your approved work is complete. Payment is being processed.";
  }
  const vendor = (input.vendorPaymentStatus ?? "").trim().toLowerCase();
  if (vendor === "invoiced" || vendor === "processing") {
    return "Your approved deliverable has been completed. Payment is being processed.";
  }
  return "Payment is pending.";
}

export function creatorPaymentExplanationForRow(
  row: CreatorPaymentRow,
  extras?: { vendorIoStatus?: string | null; pendingDeliverables?: number }
): string {
  return creatorPaymentExplanation({
    paymentStatus: row.payment_status,
    vendorPaymentStatus: row.vendor_payment_status,
    vendorIoStatus: extras?.vendorIoStatus,
    pendingDeliverables: extras?.pendingDeliverables,
  });
}
