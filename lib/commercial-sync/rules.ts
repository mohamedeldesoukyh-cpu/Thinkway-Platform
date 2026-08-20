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

/**
 * Approved quotations are locked in place. Staff must generate a new version
 * rather than editing creator commercials, deliverables, roster, or totals.
 * Sent quotations stay on the existing immutable/versioning path.
 */
export const APPROVED_QUOTATION_LOCKED_MESSAGE =
  "This quotation is approved and cannot be edited. Create a new quotation version, then send it to the client for approval.";

export const NEW_QUOTATION_VERSION_STATUS = "draft" as const satisfies QuotationStatus;

export function isApprovedQuotationLocked(status: QuotationStatus): boolean {
  return status === "approved";
}

export function approvedQuotationMutationError(
  status: QuotationStatus
): { ok: false; message: string } | null {
  if (!isApprovedQuotationLocked(status)) return null;
  return { ok: false, message: APPROVED_QUOTATION_LOCKED_MESSAGE };
}

/** Header fields that would silently mutate an approved commercial document. */
export function isApprovedQuotationCommercialHeaderPatch(
  patch: Record<string, unknown>
): boolean {
  if (patch.currency !== undefined) return true;
  if (patch.status !== undefined && patch.status !== "approved") return true;
  if (patch.client_id !== undefined) return true;
  if (patch.brand_id !== undefined) return true;
  if (patch.campaign_header_id !== undefined) return true;
  if (patch.total_cost_egp !== undefined) return true;
  if (patch.total_revenue_egp !== undefined) return true;
  if (patch.total_gp_value_egp !== undefined) return true;
  if (patch.total_gp_pct !== undefined) return true;
  if (patch.total_af_egp !== undefined) return true;
  if (patch.total_agency_margin_egp !== undefined) return true;
  return false;
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
