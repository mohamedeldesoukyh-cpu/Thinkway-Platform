const RECENT_SHORTLIST_KEY = "thinkway:recent-shortlist:v1";

export function readRecentShortlistId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(RECENT_SHORTLIST_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function writeRecentShortlistId(shortlistId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_SHORTLIST_KEY, shortlistId);
  } catch {
    // ignore quota / privacy mode
  }
}
