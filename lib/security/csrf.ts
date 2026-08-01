import { authorizeCronRequest } from "@/lib/auth/routes";
import { authorizeReadyDetailRequest } from "@/lib/auth/ready-auth";

/**
 * CSRF checks for cookie-authenticated mutating requests (P3).
 * Compatible with Supabase Auth + Next.js Server Actions.
 */

function parseAllowedOrigins(): string[] {
  const fromEnv =
    process.env.CSRF_ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const developmentAppUrl =
    process.env.NEXT_PUBLIC_DEVELOPMENT_APP_URL?.trim() ||
    "https://dev.thinkwaymedia.com";
  const productionAppUrl =
    process.env.NEXT_PUBLIC_PRODUCTION_APP_URL?.trim() ||
    "https://app.thinkwaymedia.com";
  const origins = [...fromEnv];
  for (const candidate of [appUrl, developmentAppUrl, productionAppUrl]) {
    if (!candidate) continue;
    try {
      origins.push(new URL(candidate).origin);
    } catch {
      // ignore invalid url
    }
  }
  return [...new Set(origins)];
}

function isVercelAppHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "vercel.app" || normalized.endsWith(".vercel.app");
}

function trustHostOrigin(allowed: Set<string>, proto: string, host: string) {
  allowed.add(`${proto}://${host}`);
  allowed.add(`http://${host}`);
  allowed.add(`https://${host}`);
}

/**
 * Allow Origin when it matches an allowlisted origin, the request host(s),
 * or a Vercel Preview alias pair (unique *.vercel.app ↔ *-git-*.vercel.app).
 */
export function isAllowedCsrfOrigin(
  origin: string,
  hosts: string[],
  allowedOrigins: Iterable<string>
): boolean {
  const allowed = new Set(allowedOrigins);
  if (allowed.has(origin)) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  for (const host of hosts) {
    if (!host) continue;
    if (originHost === host) return true;
    // Preview deployments expose multiple vercel.app aliases; treat as one site.
    if (isVercelAppHost(originHost) && isVercelAppHost(host)) return true;
  }

  return false;
}

export function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());
}

export type CsrfCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validate Origin / Sec-Fetch-Site / Referer for state-changing requests.
 * Skips cron Bearer and ready-detail secret callers.
 */
export function assertCsrfRequest(request: {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl?: { host: string; protocol: string };
  url?: string;
}): CsrfCheckResult {
  if (!isMutatingMethod(request.method)) {
    return { ok: true };
  }

  if (authorizeCronRequest(request)) {
    return { ok: true };
  }

  try {
    if (authorizeReadyDetailRequest(request as Request)) {
      return { ok: true };
    }
  } catch {
    // ready auth may throw if Request shape incomplete — ignore
  }

  const host =
    request.nextUrl?.host ??
    request.headers.get("host") ??
    (request.url ? new URL(request.url).host : null);

  if (!host) {
    return { ok: false, reason: "missing_host" };
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;

  const origin = request.headers.get("origin");
  const allowed = new Set(parseAllowedOrigins());
  const proto =
    request.nextUrl?.protocol?.replace(":", "") ||
    (request.headers.get("x-forwarded-proto") ?? "https");

  trustHostOrigin(allowed, proto, host);
  if (forwardedHost) {
    trustHostOrigin(allowed, proto, forwardedHost);
  }

  const requestHosts = [host, forwardedHost].filter(Boolean) as string[];

  if (origin) {
    if (isAllowedCsrfOrigin(origin, requestHosts, allowed)) {
      return { ok: true };
    }
    return { ok: false, reason: "origin_mismatch" };
  }

  // No Origin (some same-site navigations / older clients): require Sec-Fetch-Site or Referer.
  const fetchSite = (request.headers.get("sec-fetch-site") ?? "").toLowerCase();
  if (
    fetchSite === "same-origin" ||
    fetchSite === "same-site" ||
    fetchSite === "none"
  ) {
    return { ok: true };
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isAllowedCsrfOrigin(refOrigin, requestHosts, allowed)) {
        return { ok: true };
      }
    } catch {
      return { ok: false, reason: "invalid_referer" };
    }
    return { ok: false, reason: "referer_mismatch" };
  }

  // Server Actions from Next always send Origin in modern browsers; in tests /
  // development without Origin, allow only when NODE_ENV is development.
  if (process.env.NODE_ENV === "development") {
    return { ok: true };
  }

  return { ok: false, reason: "missing_origin" };
}
