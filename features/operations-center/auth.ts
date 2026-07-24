import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext } from "@/lib/auth/permissions-server";
import {
  isPortalActor,
  resolveWorkspaceActor,
} from "@/lib/security/workspace-actor";

import { canAccessOperationsCenter } from "./roles";

export { canAccessOperationsCenter, OPERATIONS_CENTER_ROLES } from "./roles";

export async function requireOperationsCenterAccess(
  supabase: SupabaseClient,
): Promise<{ userId: string; roleSlug: string } | { error: string; status: number }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const actor = await resolveWorkspaceActor(supabase, ctx.userId);
  if (isPortalActor(actor.kind)) {
    return {
      error: "Portal users cannot access the Operations Center.",
      status: 403,
    };
  }

  if (!canAccessOperationsCenter(ctx.roleSlug)) {
    return {
      error:
        "Operations Center is limited to Super Admin, Admin, Operations, and DevOps.",
      status: 403,
    };
  }

  return { userId: ctx.userId, roleSlug: ctx.roleSlug! };
}
