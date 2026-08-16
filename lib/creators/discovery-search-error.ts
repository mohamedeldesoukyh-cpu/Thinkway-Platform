/**
 * User-visible Discovery Search errors.
 *
 * Thrown Server Actions are replaced in Production with a generic
 * "Server Components render" digest. Map those (and statement timeouts)
 * to a stable message the UI can show.
 */

export const DISCOVERY_SEARCH_TIMEOUT_MESSAGE =
  "Creator search timed out. Try a more specific name or handle.";

export const DISCOVERY_SEARCH_MASKED_MESSAGE =
  "Creator search took too long to load. Refresh the page, or try a more specific name or handle.";

export function isMaskedServerActionError(message: string): boolean {
  return /Server Components render|digest property is included/i.test(message);
}

export function isDiscoverySearchTimeoutError(message: string): boolean {
  return /statement timeout|canceling statement|timed out/i.test(message);
}

export function mapDiscoverySearchError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Creator search failed";

  if (isMaskedServerActionError(message)) {
    return DISCOVERY_SEARCH_MASKED_MESSAGE;
  }
  if (isDiscoverySearchTimeoutError(message)) {
    return DISCOVERY_SEARCH_TIMEOUT_MESSAGE;
  }
  return message.trim() || "Creator search failed";
}
