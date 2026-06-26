import type { QuotationStatus } from "@/types/database";

/** Live bidirectional sync is enabled only while the quotation is editable. */
export function isCommercialSyncEnabled(status: QuotationStatus): boolean {
  return status === "draft" || status === "under_review";
}

/** Sent / approved / terminal states freeze the commercial snapshot. */
export function isQuotationCommercialImmutable(status: QuotationStatus): boolean {
  return (
    status === "sent" ||
    status === "approved" ||
    status === "accepted" ||
    status === "rejected" ||
    status === "archived" ||
    status === "cancelled"
  );
}

/** Only approved quotations may spawn campaigns. */
export function canCreateCampaignFromQuotation(status: QuotationStatus): boolean {
  return status === "approved";
}

/** New document versions may be generated after the quotation leaves draft. */
export function canGenerateQuotationVersion(status: QuotationStatus): boolean {
  return status === "sent" || status === "approved" || status === "accepted";
}

export function stripQuotationVersionSuffix(serial: string | null | undefined): string {
  if (!serial) return "";
  return serial.trim().replace(/-V\d+$/, "");
}

export function formatVersionedQuotationSerial(
  baseSerial: string,
  versionNumber: number
): string {
  const base = stripQuotationVersionSuffix(baseSerial);
  if (!base) return "";
  if (versionNumber <= 1) return base;
  return `${base}-V${versionNumber}`;
}

export function nextVersionNumber(currentMax: number): number {
  return Math.max(1, currentMax + 1);
}
