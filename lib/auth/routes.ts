import { pathBlockedForPortal, portalHomePath } from "@/lib/security/workspace-auth";
import type { WorkspaceActorKind } from "@/lib/security/workspace-actor";

/** Routes that do not require an authenticated session. */
export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/auth",
  "/creator-invite",
  "/io-approval",
  "/review",
  "/api/review",
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

/**
 * Sanitize post-login / OAuth `next` redirect targets.
 * Rejects open redirects: protocol-relative URLs, schemes, backslash tricks,
 * and encoded bypasses (via repeated decodeURIComponent).
 */
export function sanitizeNextPath(path: string | null | undefined): string {
  if (!path) return "/";

  let value = path.trim();
  if (!value) return "/";

  try {
    for (let i = 0; i < 5; i += 1) {
      const decoded = decodeURIComponent(value.replace(/\+/g, "%20"));
      if (decoded === value) break;
      value = decoded;
    }
  } catch {
    return "/";
  }

  value = value.trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("///")) return "/";
  if (value.startsWith("/\\") || value.startsWith("/\u005c")) return "/";
  if (value.includes("\\") || value.includes("\u005c")) return "/";
  if (/[\u0000-\u001F\u007F]/.test(value)) return "/";
  if (value.toLowerCase().includes("javascript:")) return "/";
  if (value.includes("://")) return "/";
  // Reject "/https:..." style and other scheme-like segments after slash.
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return "/";

  const pathOnly = value.split(/[?#]/, 1)[0] ?? "/";
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) return "/";
  if (pathOnly === "/creator-invite") return value;
  if (isPublicPath(pathOnly)) return "/";

  return value;
}

/**
 * After login, portal actors must land in their portal — never on internal
 * Finance / Operations / Discovery paths via `?next=`.
 */
export function sanitizeNextPathForActor(
  path: string | null | undefined,
  actorKind: WorkspaceActorKind,
): string {
  const next = sanitizeNextPath(path);
  if (actorKind === "client_portal" || actorKind === "creator_portal") {
    if (pathBlockedForPortal(next.split(/[?#]/, 1)[0] ?? next)) {
      return portalHomePath(actorKind);
    }
  }
  return next;
}
