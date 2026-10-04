/** Historical IOs remain visible but never count as operational work. */
export function isActiveVendorIo(row: { status?: string | null; is_superseded?: boolean | null }): boolean {
  return !row.is_superseded && !["cancelled", "superseded"].includes((row.status ?? "").toLowerCase());
}
