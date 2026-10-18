/** Stable identities: multiple options/platform entries must not inflate creator counts. */
export function quotationListCreatorKey(item: {
  id: string; unified_id: string | null; influencer_id: string | null;
  profile_id: string | null; creator_name: string | null; handle: string | null;
}): string {
  if (item.unified_id) return `u:${item.unified_id}`;
  if (item.influencer_id) return `i:${item.influencer_id}`;
  if (item.profile_id) return `p:${item.profile_id}`;
  const handle = item.handle?.trim().replace(/^@+/, "").toLowerCase();
  const name = item.creator_name?.trim().toLowerCase();
  return handle ? `h:${handle}` : name ? `n:${name}` : `item:${item.id}`;
}

export function countQuotationListCreators(rows: Array<{ creator_keys?: string[] }>): number {
  return new Set(rows.flatMap((row) => row.creator_keys ?? [])).size;
}
