type CreatorIdentity = { unified_id: string; influencer_id?: string | null; discovered_profile_id?: string | null };

/** Background work must never replace a different creator currently being edited. */
export function sameCreatorIdentity(current: CreatorIdentity | null | undefined, next: CreatorIdentity): boolean {
  if (!current) return false;
  return current.unified_id === next.unified_id
    || Boolean(current.influencer_id && current.influencer_id === next.influencer_id)
    || Boolean(current.discovered_profile_id && current.discovered_profile_id === next.discovered_profile_id);
}
