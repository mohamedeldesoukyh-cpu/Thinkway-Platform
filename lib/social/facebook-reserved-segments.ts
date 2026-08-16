/**
 * First path segments that are Facebook product shells — never creator usernames.
 * Shared by profile URL parsing and content-URL handle extraction.
 */
export const FACEBOOK_RESERVED_PATH_SEGMENTS = new Set([
  "watch",
  "reel",
  "reels",
  "video",
  "videos",
  "photo",
  "photos",
  "story",
  "stories",
  "share",
  "sharer",
  "groups",
  "events",
  "marketplace",
  "gaming",
  "login",
  "help",
  "privacy",
  "policies",
  "ads",
  "business",
  "lite",
  "dialog",
  "plugins",
  "hashtag",
  "live",
  "media",
  "pg",
  "notes",
  "recover",
  // Search / chrome shells (facebook.com/search/... must never become handle "search")
  "search",
  "home",
  "friends",
  "messages",
  "notifications",
  "settings",
  "bookmarks",
  "saved",
  "menu",
  "checkout",
  "permalink.php",
  "story.php",
  "profile.php",
  "pages",
  "people",
]);

export function isFacebookReservedPathSegment(
  segment: string | null | undefined
): boolean {
  const value = segment?.trim().toLowerCase();
  if (!value) return false;
  return FACEBOOK_RESERVED_PATH_SEGMENTS.has(value);
}

/** True when a stored Facebook handle is a product shell, not a real username. */
export function isFacebookShellHandle(handle: string | null | undefined): boolean {
  const normalized = handle?.trim().replace(/^@+/, "").toLowerCase();
  if (!normalized) return false;
  return isFacebookReservedPathSegment(normalized);
}
