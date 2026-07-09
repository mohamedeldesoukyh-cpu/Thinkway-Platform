import { createServerClient } from "@supabase/ssr";
import type { AuthError, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export type RequestAuth = {
  user: User | null;
  fullName: string | null;
  roleSlug: string | null;
  error: AuthError | null;
};

export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component — session refresh is handled in middleware.
        }
      },
    },
  });
});

/**
 * Request-scoped auth resolution: validates the JWT once per HTTP request and
 * loads profile fields (full_name, role slug) in a single query.
 * Do not use getSession() on the server.
 */
export const getRequestAuth = cache(async (): Promise<RequestAuth> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, fullName: null, roleSlug: null, error: error ?? null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role:roles(slug)")
    .eq("id", user.id)
    .maybeSingle();

  type ProfileRow = { full_name: string | null; role: { slug: string } | null };
  const row = profile as ProfileRow | null;

  return {
    user,
    fullName: row?.full_name?.trim() || null,
    roleSlug: row?.role?.slug ?? null,
    error: null,
  };
});

/** Validates the JWT with Supabase Auth (do not use getSession() on the server). */
export async function getAuthUser() {
  const { user, fullName, error } = await getRequestAuth();
  return { user, fullName, error };
}

export type RequestUser = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: User;
  userId: string;
  fullName: string | null;
  roleSlug: string | null;
};

/**
 * Authenticated request context for server modules (queries, actions, route loaders).
 *
 * - **`getRequestAuth()`** — optional auth; returns nullable user without throwing.
 * - **`requireRequestUser()`** — requires a signed-in user; throws `Error` on failure.
 * - **`requirePermission()`** (`@/lib/auth/permissions-server`) — requires auth plus a
 *   specific permission; returns `{ error }` for server actions / API routes that
 *   should not throw.
 */
export async function requireRequestUser(): Promise<RequestUser> {
  const supabase = await createSupabaseServerClient();
  const { user, fullName, roleSlug, error } = await getRequestAuth();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return {
    supabase,
    user,
    userId: user.id,
    fullName,
    roleSlug,
  };
}
