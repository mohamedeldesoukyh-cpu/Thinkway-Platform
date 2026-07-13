/**
 * Rules for syncing shortlist commercial links to linked quotations.
 * Temporary quotations are never overwritten; master quotations are updated only
 * when their client/brand are unset or still mirror the shortlist's prior link.
 */

export type QuotationCommercialSnapshot = {
  id: string;
  client_id: string | null;
  brand_id: string | null;
  is_temporary_client: boolean;
  is_temporary_brand: boolean;
};

export function shouldSyncQuotationCommercial(
  quotation: QuotationCommercialSnapshot,
  oldShortlist: { client_id: string | null; brand_id: string | null },
  newShortlist: { client_id: string | null; brand_id: string | null }
): boolean {
  if (quotation.is_temporary_client || quotation.is_temporary_brand) return false;
  if (!newShortlist.client_id || !newShortlist.brand_id) return false;

  const clientMatchesShortlist =
    !quotation.client_id || quotation.client_id === oldShortlist.client_id;
  const brandMatchesShortlist =
    !quotation.brand_id || quotation.brand_id === oldShortlist.brand_id;

  return clientMatchesShortlist && brandMatchesShortlist;
}

export function buildQuotationCommercialPatch(
  newShortlist: { client_id: string | null; brand_id: string | null }
): { client_id: string; brand_id: string } | null {
  if (!newShortlist.client_id || !newShortlist.brand_id) return null;
  return {
    client_id: newShortlist.client_id,
    brand_id: newShortlist.brand_id,
  };
}
