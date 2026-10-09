/** A linked shortlist with a recorded client owns the quotation identity. */
export function shortlistClientConflict(
  source: { client_id: string | null; brand_id: string | null },
  patch: Record<string, unknown>,
): string | null {
  if (!source.client_id) return null;
  if (patch.is_temporary_client === true || patch.is_temporary_brand === true ||
      (patch.client_id !== undefined && patch.client_id !== source.client_id) ||
      (source.brand_id && patch.brand_id !== undefined && patch.brand_id !== source.brand_id)) {
    return "Client and brand are inherited from the linked shortlist. Restore the shortlist values; they cannot be changed independently on this quotation.";
  }
  return null;
}
