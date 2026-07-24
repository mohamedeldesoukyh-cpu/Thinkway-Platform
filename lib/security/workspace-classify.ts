import {
  API_ROUTE_CLASSIFICATIONS,
  PAGE_PREFIX_CLASSIFICATIONS,
  SERVER_ACTION_MODULE_CLASSIFICATIONS,
} from "@/lib/security/workspace-classification-registry";
import type { WorkspaceClass } from "@/lib/security/workspace-class";

/**
 * Normalize a filesystem or request path for API lookup.
 * `/api/ai/conversations/abc/messages/xyz` → `/api/ai/conversations/[id]/messages/[messageId]`
 */
export function normalizeApiPathForClassification(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname;
  if (!path.startsWith("/api/")) return path;

  // Prefer exact match first
  if (API_ROUTE_CLASSIFICATIONS[path]) return path;

  // Match against registered templates by segment shape
  const parts = path.split("/").filter(Boolean);
  let best: string | null = null;
  let bestScore = -1;

  for (const template of Object.keys(API_ROUTE_CLASSIFICATIONS)) {
    const tParts = template.split("/").filter(Boolean);
    if (tParts.length !== parts.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < tParts.length; i++) {
      const t = tParts[i]!;
      const p = parts[i]!;
      if (t.startsWith("[") && t.endsWith("]")) {
        score += 1;
        continue;
      }
      if (t === p) {
        score += 10;
        continue;
      }
      ok = false;
      break;
    }
    if (ok && score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return best ?? path;
}

export function classifyApiPath(pathname: string): WorkspaceClass | null {
  const key = normalizeApiPathForClassification(pathname);
  return API_ROUTE_CLASSIFICATIONS[key] ?? null;
}

export function classifyPagePath(pathname: string): WorkspaceClass | null {
  const path = pathname.split("?")[0] ?? pathname;
  // Longest prefix first
  const sorted = [...PAGE_PREFIX_CLASSIFICATIONS].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const rule of sorted) {
    if (rule.prefix === "/") {
      return rule.class;
    }
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.class;
    }
  }
  return null;
}

export function classifyPath(pathname: string): WorkspaceClass | null {
  if (pathname.startsWith("/api/")) return classifyApiPath(pathname);
  return classifyPagePath(pathname);
}

export function classifyServerActionModule(
  modulePath: string,
): WorkspaceClass | null {
  const normalized = modulePath.replace(/\\/g, "/");
  const keys = Object.keys(SERVER_ACTION_MODULE_CLASSIFICATIONS).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (
      normalized.includes(`/${key}/`) ||
      normalized.startsWith(`${key}/`) ||
      normalized.includes(key)
    ) {
      return SERVER_ACTION_MODULE_CLASSIFICATIONS[key] ?? null;
    }
  }
  return null;
}

export function isInternalOrAdminClass(cls: WorkspaceClass): boolean {
  return cls === "internal_workspace" || cls === "admin_only";
}

export function isServiceClass(cls: WorkspaceClass): boolean {
  return cls === "service_only";
}
