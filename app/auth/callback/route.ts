import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/routes";
import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/security/cookie-options";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
import { loadModuleAccess, moduleHome, isAccountingPath } from "@/lib/auth/module-access";
import { resolveWorkspaceActor } from "@/lib/security/workspace-actor";
import { portalHomePath } from "@/lib/security/workspace-auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next") ?? "/");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, _headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {data:{user}} = await supabase.auth.getUser();
      const actor = await resolveWorkspaceActor(supabase,user?.id);
      if (actor.kind === "client_portal" || actor.kind === "creator_portal") return NextResponse.redirect(new URL(portalHomePath(actor.kind),origin));
      try {
        const access = await loadModuleAccess(supabase);
        const destination = next === "/" || (isAccountingPath(next) ? !access.accounting : !access.media) ? moduleHome(access) : next;
        return NextResponse.redirect(new URL(destination,origin));
      } catch { return NextResponse.redirect(new URL("/login?error=module_access_unavailable",origin)); }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
