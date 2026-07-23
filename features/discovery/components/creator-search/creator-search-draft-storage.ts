const DISCOVERY_SEARCH_DRAFT_KEY = "thinkway:discovery-search-draft";

export function readDiscoverySearchDraft(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(DISCOVERY_SEARCH_DRAFT_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeDiscoverySearchDraft(value: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const trimmed = value.trim();
    if (!trimmed) {
      sessionStorage.removeItem(DISCOVERY_SEARCH_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(DISCOVERY_SEARCH_DRAFT_KEY, value);
  } catch {
    // ignore quota / private mode
  }
}

export function clearDiscoverySearchDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(DISCOVERY_SEARCH_DRAFT_KEY);
  } catch {
    // ignore
  }
}
