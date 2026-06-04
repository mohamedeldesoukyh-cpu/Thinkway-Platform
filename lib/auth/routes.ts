/** Routes that do not require an authenticated session. */
export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/auth",
  "/io-approval",
  "/api/build-info",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
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
