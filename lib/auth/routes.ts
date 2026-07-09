/** Routes that do not require an authenticated session. */
export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/auth",
  "/io-approval",
  "/api/build-info",
  "/api/health",
  "/api/ready",
  "/api/version",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isCronPath(pathname: string): boolean {
  return pathname.startsWith("/api/cron/");
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function authorizeCronRequest(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function sanitizeNextPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  if (isPublicPath(path)) {
    return "/";
  }

  return path;
}
