/** A /p/ URL is ambiguous; use explicit provider media classification. */
export function confirmedPublicationType(platform: string, payload: unknown): 'instagram_reel' | null {
  if (platform !== 'instagram' || !payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  if (row.error || row.errorDescription) return null;
  const product = String(row.productType ?? row.product_type ?? '').toLowerCase();
  return ['clips','reels','reel'].includes(product) ? 'instagram_reel' : null;
}
