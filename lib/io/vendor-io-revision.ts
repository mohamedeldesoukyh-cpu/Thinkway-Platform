/** Base VIO document number without revision suffix (VIO-2026-0001/2 → VIO-2026-0001). */
export function vendorIoBaseDocumentNumber(documentNumber: string): string {
  const trimmed = documentNumber.trim();
  const slash = trimmed.indexOf("/");
  return slash >= 0 ? trimmed.slice(0, slash) : trimmed;
}

export function vendorIoRevisionDocumentNumber(
  baseDocumentNumber: string,
  revisionNumber: number
): string {
  const base = vendorIoBaseDocumentNumber(baseDocumentNumber);
  if (revisionNumber <= 0) return base;
  return `${base}/${revisionNumber}`;
}
