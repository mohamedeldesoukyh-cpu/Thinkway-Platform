/**
 * Strict URL allowlisting and private-network rejection for outbound fetches (P2 SSRF).
 */

export type HostAllowlist = {
  /** Exact hostnames (lowercase), e.g. "youtu.be" */
  exact: readonly string[];
  /** Suffixes without leading dot, e.g. "instagram.com" matches that host and subdomains */
  suffixes: readonly string[];
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const METADATA_IPV4 = new Set(["169.254.169.254", "169.254.170.2"]);

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

export function isExactHostOrSuffix(hostname: string, allowlist: HostAllowlist): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  if (allowlist.exact.some((entry) => host === normalizeHostname(entry))) {
    return true;
  }
  return allowlist.suffixes.some((suffix) => {
    const s = normalizeHostname(suffix);
    return host === s || host.endsWith(`.${s}`);
  });
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isIpv6Literal(host: string): boolean {
  return host.includes(":");
}

/** True when the host is a blocked loopback / private / link-local / metadata target. */
export function isBlockedSsrfHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }

  if (host === "::1" || host === "[::1]" || host === "0:0:0:0:0:0:0:1") return true;
  if (isIpv6Literal(host)) {
    const bare = host.replace(/^\[|\]$/g, "");
    if (bare === "::1") return true;
    // Unique local / link-local IPv6
    if (/^f[cd][0-9a-f]{2}:/i.test(bare) || /^fe[89ab][0-9a-f]:/i.test(bare)) {
      return true;
    }
    return false;
  }

  const ipv4 = parseIpv4(host);
  if (!ipv4) return false;

  const [a, b] = ipv4;
  if (METADATA_IPV4.has(host)) return true;
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

export type SafeUrlParseResult =
  | { ok: true; url: URL; hostname: string }
  | { ok: false; reason: string };

/**
 * Parse and harden a URL for outbound server-side fetch.
 * Default: https only, no credentials, no private/metadata hosts.
 */
export function parseSafeOutboundUrl(
  raw: string,
  options?: { allowHttp?: boolean }
): SafeUrlParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol === "https:") {
    // ok
  } else if (protocol === "http:" && options?.allowHttp) {
    // ok
  } else {
    return { ok: false, reason: "scheme" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials" };
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) return { ok: false, reason: "hostname" };
  if (isBlockedSsrfHostname(hostname)) {
    return { ok: false, reason: "private_or_metadata" };
  }

  return { ok: true, url, hostname };
}

export function isUrlAllowedByHostlist(
  raw: string,
  allowlist: HostAllowlist,
  options?: { allowHttp?: boolean }
): boolean {
  const parsed = parseSafeOutboundUrl(raw, options);
  if (!parsed.ok) return false;
  return isExactHostOrSuffix(parsed.hostname, allowlist);
}

/** Resolve Location header against a base URL; return absolute href or null. */
export function resolveRedirectLocation(
  baseUrl: string,
  locationHeader: string | null
): string | null {
  if (!locationHeader?.trim()) return null;
  try {
    return new URL(locationHeader.trim(), baseUrl).href;
  } catch {
    return null;
  }
}

export type SafeFetchRedirectOptions = {
  allowlist: HostAllowlist;
  allowHttp?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  headers?: HeadersInit;
  /** Called before each hop (including the first). Return false to abort. */
  assertUrl?: (url: string) => boolean;
};

/**
 * fetch() with redirect: manual and allowlist checks on every hop.
 */
export async function fetchWithStrictRedirects(
  initialUrl: string,
  options: SafeFetchRedirectOptions
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  let current = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!isUrlAllowedByHostlist(current, options.allowlist, { allowHttp: options.allowHttp })) {
      throw new Error(`SSRF blocked URL: ${current}`);
    }
    if (options.assertUrl && !options.assertUrl(current)) {
      throw new Error(`SSRF assert failed: ${current}`);
    }

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      headers: options.headers,
    });

    if (response.status >= 300 && response.status < 400) {
      const next = resolveRedirectLocation(current, response.headers.get("location"));
      if (!next) {
        throw new Error("SSRF redirect missing Location");
      }
      current = next;
      continue;
    }

    return response;
  }

  throw new Error("SSRF too many redirects");
}

/** Publication / avatar CDN + social host allowlists (exact / suffix only). */
export const SOCIAL_MEDIA_SRC_ALLOWLIST: HostAllowlist = {
  exact: ["youtu.be", "i.ytimg.com", "img.youtube.com"],
  suffixes: [
    "cdninstagram.com",
    "instagram.com",
    "fbcdn.net",
    "fbsbx.com",
    "facebook.com",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokv.com",
    "ibyteimg.com",
    "ibytedtos.com",
    "byteoversea.com",
    "ttwstatic.com",
    "muscdn.com",
    "ytimg.com",
    "youtube.com",
  ],
};

export const SOCIAL_POST_ALLOWLIST: HostAllowlist = {
  exact: ["youtu.be", "fb.watch"],
  suffixes: ["instagram.com", "tiktok.com", "youtube.com", "facebook.com", "fb.com"],
};

export const SOCIAL_PROFILE_ALLOWLIST: HostAllowlist = {
  exact: ["youtu.be", "fb.watch"],
  suffixes: ["instagram.com", "tiktok.com", "youtube.com", "facebook.com", "fb.com"],
};
