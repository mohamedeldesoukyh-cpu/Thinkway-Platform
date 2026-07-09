/** True when a platform row already has usable preview data (e.g. open-graph on add). */
export function accountHasUsableBaselineData(account: {
  follower_count?: number | null;
  profile_display_name?: string | null;
  profile_bio?: string | null;
  profile_picture_url?: string | null;
  handle?: string | null;
  username?: string | null;
}): boolean {
  if ((account.follower_count ?? 0) > 0) return true;
  if (account.profile_bio?.trim()) return true;
  if (account.profile_picture_url?.trim()) return true;

  const displayName = account.profile_display_name?.trim();
  if (!displayName) return false;

  const handle = (account.handle ?? account.username ?? "").replace(/^@+/, "").trim().toLowerCase();
  const normalizedDisplay = displayName.replace(/^@+/, "").trim().toLowerCase();
  if (handle && normalizedDisplay === handle) return false;

  return true;
}

export function accountsHaveUsableBaselineData(
  accounts: Array<{
    follower_count?: number | null;
    profile_display_name?: string | null;
    profile_bio?: string | null;
    profile_picture_url?: string | null;
  }>
): boolean {
  return accounts.some(accountHasUsableBaselineData);
}
