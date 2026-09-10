/**
 * An avatar that already resolved must never be replaced by a later wave.
 *
 * `CreatorAvatarImage` builds its src as
 * `/api/creators/avatar?src=…&profileUrl=…`, and `useMediaProxyImageRecovery`
 * resets its retry counter and its `exhausted` latch whenever that string
 * changes. So when a later wave supplied a `profileUrl` for a creator whose
 * avatar was already correct, the src string changed, the retry sequence
 * restarted from zero, and `<img key={displaySrc}>` remounted — the avatar
 * flashed, reloaded, and could never settle on the stable fallback because
 * `exhausted` was cleared before it could latch.
 *
 * Keeping the first resolved values is also the truer answer: wave 1 read them
 * from the same Discovery record, so a later wave has nothing better to say.
 */
export type ResolvedCreatorAvatar = {
  avatarUrl?: string;
  profileUrl?: string;
};

export function preserveResolvedAvatar(
  previous: ResolvedCreatorAvatar,
  next: ResolvedCreatorAvatar
): ResolvedCreatorAvatar {
  // Only a creator with NO avatar yet takes the later wave's values, and then
  // it takes both together so src and profileUrl stay consistent.
  if (!previous.avatarUrl) {
    return {
      avatarUrl: next.avatarUrl ?? previous.avatarUrl,
      profileUrl: next.profileUrl ?? previous.profileUrl,
    };
  }
  return { avatarUrl: previous.avatarUrl, profileUrl: previous.profileUrl };
}
