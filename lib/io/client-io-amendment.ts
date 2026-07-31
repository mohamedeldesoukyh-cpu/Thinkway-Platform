/** Base CIO document number without amendment suffix (CIO-2026-0001/A2 → CIO-2026-0001). */
export function clientIoBaseDocumentNumber(documentNumber: string): string {
  const trimmed = documentNumber.trim();
  const slash = trimmed.indexOf("/");
  return slash >= 0 ? trimmed.slice(0, slash) : trimmed;
}

/**
 * Amendment document numbers use `/A{n}` (kickoff-approved).
 * revision 0 → CIO-YYYY-NNNN · revision 1 → CIO-YYYY-NNNN/A1
 */
export function clientIoAmendmentDocumentNumber(
  baseDocumentNumber: string,
  revisionNumber: number
): string {
  const base = clientIoBaseDocumentNumber(baseDocumentNumber);
  if (revisionNumber <= 0) return base;
  return `${base}/A${revisionNumber}`;
}

/** Tip statuses that may open a new append-only amendment. */
export const CLIENT_IO_AMENDMENT_ALLOWED_STATUSES = new Set([
  "sent",
  "under_client_review",
  "approved",
  "rejected",
]);

export function isClientIoAmendmentAllowed(status: string, isSuperseded = false): boolean {
  if (isSuperseded) return false;
  return CLIENT_IO_AMENDMENT_ALLOWED_STATUSES.has(status);
}

export function formatClientIoAmendmentLabel(revisionNumber: number): string {
  if (revisionNumber <= 0) return "Original";
  return `Amendment A${revisionNumber}`;
}
