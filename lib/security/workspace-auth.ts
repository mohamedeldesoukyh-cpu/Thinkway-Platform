import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PORTAL_BLOCKED_API_PREFIXES,
  PORTAL_BLOCKED_PAGE_PREFIXES,
} from "@/lib/security/workspace-classification-registry";
import {
  isPortalActor,
  resolveWorkspaceActor,
  type WorkspaceActorKind,
} from "@/lib/security/workspace-actor";
import {
  classifyPath,
  isInternalOrAdminClass,
  isServiceClass,
} from "@/lib/security/workspace-classify";
import type { WorkspaceClass } from "@/lib/security/workspace-class";

export class WorkspaceAuthorizationError extends Error {
  readonly code = "WORKSPACE_FORBIDDEN" as const;
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "WorkspaceAuthorizationError";
    this.status = status;
  }
}

export function pathBlockedForPortal(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;

  if (path.startsWith("/api/")) {
    return PORTAL_BLOCKED_API_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  if (path === "/") return true;

  return PORTAL_BLOCKED_PAGE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function portalHomePath(kind: WorkspaceActorKind): string {
  if (kind === "creator_portal") return "/creator-portal";
  if (kind === "client_portal") return "/client-portal";
  return "/";
}

/**
 * Decide whether a request path is allowed for the given actor kind.
 * Unclassified APIs are denied (fail-closed).
 */
export function authorizeWorkspacePath(
  pathname: string,
  actorKind: WorkspaceActorKind,
): { allowed: boolean; reason?: string; class: WorkspaceClass | null } {
  const cls = classifyPath(pathname);

  if (pathname.startsWith("/api/") && cls === null) {
    return {
      allowed: false,
      reason: "Unclassified API route",
      class: null,
    };
  }

  if (actorKind === "anonymous") {
    if (cls === "public") return { allowed: true, class: cls };
    // Auth pages / redirects handled elsewhere; deny privileged surfaces
    if (cls === "service_only" || cls === "admin_only" || cls === "internal_workspace") {
      return { allowed: false, reason: "Authentication required", class: cls };
    }
    return { allowed: true, class: cls };
  }

  if (isPortalActor(actorKind)) {
    if (cls === "service_only") {
      return { allowed: false, reason: "Service-only endpoint", class: cls };
    }
    if (cls === "admin_only" || (cls && isInternalOrAdminClass(cls))) {
      if (pathBlockedForPortal(pathname) || isInternalOrAdminClass(cls)) {
        return {
          allowed: false,
          reason: "Portal actors cannot access internal workspace",
          class: cls,
        };
      }
    }
    if (pathBlockedForPortal(pathname)) {
      return {
        allowed: false,
        reason: "Portal actors cannot access internal workspace",
        class: cls,
      };
    }
    return { allowed: true, class: cls };
  }

  // Internal staff
  if (cls === "service_only" && pathname.startsWith("/api/cron")) {
    return {
      allowed: false,
      reason: "Cron endpoints require service credentials",
      class: cls,
    };
  }

  return { allowed: true, class: cls };
}

export async function assertInternalWorkspaceActor(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const actor = await resolveWorkspaceActor(supabase, userId);
  if (isPortalActor(actor.kind)) {
    throw new WorkspaceAuthorizationError(
      "Portal users cannot invoke internal workspace operations.",
    );
  }
}

export async function assertPortalActorNotOnInternalPath(
  supabase: SupabaseClient,
  userId: string | null,
  pathname: string,
): Promise<{ kind: WorkspaceActorKind; denied: boolean; redirectTo?: string }> {
  const actor = await resolveWorkspaceActor(supabase, userId);
  const decision = authorizeWorkspacePath(pathname, actor.kind);
  if (!decision.allowed && isPortalActor(actor.kind)) {
    return {
      kind: actor.kind,
      denied: true,
      redirectTo: portalHomePath(actor.kind),
    };
  }
  if (!decision.allowed && isServiceClass(decision.class ?? "public")) {
    return { kind: actor.kind, denied: true };
  }
  return { kind: actor.kind, denied: !decision.allowed };
}
