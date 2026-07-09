import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext, requirePermission } from "@/lib/auth/permissions-server";
import { hasPermission } from "@/lib/auth/permissions";

export function apiUnauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function apiForbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

type ApiAuthOk = { userId: string; roleSlug: string | null };
type ApiAuthErr = { response: NextResponse };

export async function requireApiPermission(
  supabase: SupabaseClient,
  permission: string
): Promise<ApiAuthOk | ApiAuthErr> {
  const auth = await requirePermission(supabase, permission);
  if ("error" in auth) {
    const status = auth.error === "Unauthorized" ? 401 : 403;
    return { response: NextResponse.json({ error: auth.error }, { status }) };
  }
  return auth;
}

/** Succeed when the user has any of the listed permissions (admins always pass). */
export async function requireApiAnyPermission(
  supabase: SupabaseClient,
  permissions: string[]
): Promise<ApiAuthOk | ApiAuthErr> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return {
      response: NextResponse.json(
        { error: ctx.error ?? "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const isPrivileged =
    ctx.roleSlug === "super_admin" || ctx.roleSlug === "admin";
  if (isPrivileged) {
    return { userId: ctx.userId, roleSlug: ctx.roleSlug };
  }

  for (const permission of permissions) {
    if (await hasPermission(supabase, permission)) {
      return { userId: ctx.userId, roleSlug: ctx.roleSlug };
    }
  }

  return {
    response: NextResponse.json(
      { error: "You do not have permission to perform this action." },
      { status: 403 }
    ),
  };
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
