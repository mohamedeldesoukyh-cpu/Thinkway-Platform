export type VendorIoDeliveryMethod = "email" | "manual";

export type VendorIoDeliveryStatus = "sent" | "failed" | "completed";

/** Stored in vendor_ios.delivery_recipient for manual delivery. */
export const VENDOR_IO_MANUAL_DELIVERY_RECIPIENT = "Manual";

export function hasValidVendorEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function formatVendorIoDeliveryLabel(
  method: string | null | undefined,
  status: string | null | undefined
): string | null {
  if (method === "email" && status === "sent") return "Email Sent";
  if (method === "email" && status === "failed") return "Email Failed";
  if (method === "manual" && status === "completed") return "Delivered Manually";
  return null;
}
