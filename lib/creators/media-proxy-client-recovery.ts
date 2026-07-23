/**
 * Browser recovery after Phase 2 media-proxy fail-fast.
 * Request path returns 404 + schedules after() warm; clients must re-request
 * with a cache-busting query so browsers do not stick on max-age=30 404s.
 */

/** Delays (ms) before each retry attempt after the first error. */
export const MEDIA_PROXY_CLIENT_RETRY_DELAYS_MS = [900, 2200, 5000] as const;

export const MEDIA_PROXY_RETRY_QUERY = "_twr";

export function isMediaProxyApiUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("/api/creators/avatar") ||
    src.startsWith("/api/creators/publication-preview") ||
    src.includes("/api/creators/avatar?") ||
    src.includes("/api/creators/publication-preview?")
  );
}

/** Append or bump a retry bust param so cached 404s are not reused. */
export function withMediaProxyRetryBust(
  src: string,
  attempt: number
): string {
  if (attempt <= 0 || !isMediaProxyApiUrl(src)) return src;
  try {
    const url = new URL(src, "http://localhost");
    url.searchParams.set(MEDIA_PROXY_RETRY_QUERY, String(attempt));
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}${MEDIA_PROXY_RETRY_QUERY}=${attempt}`;
  }
}

export function mediaProxyRetryDelayMs(attemptIndex: number): number | null {
  if (attemptIndex < 0 || attemptIndex >= MEDIA_PROXY_CLIENT_RETRY_DELAYS_MS.length) {
    return null;
  }
  return MEDIA_PROXY_CLIENT_RETRY_DELAYS_MS[attemptIndex] ?? null;
}

export function maxMediaProxyClientRetries(): number {
  return MEDIA_PROXY_CLIENT_RETRY_DELAYS_MS.length;
}
