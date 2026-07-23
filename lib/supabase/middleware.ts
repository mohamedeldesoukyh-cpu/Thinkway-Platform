import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  authorizeCronRequest,
  isApiPath,
  isCronPath,
  isPublicPath,
} from "@/lib/auth/routes";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * Server Actions POST to the page URL. Middleware redirects return HTML/307 and
 * break the action protocol ("An unexpected response was received from the server").
 * Still refresh the session — just skip navigation redirects for these requests.
 */
function isServerActionRequest(request: NextRequest): boolean {
  if (request.headers.has("next-action") || request.headers.has("Next-Action")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return request.method === "POST" && accept.includes("text/x-component");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);
  const serverAction = isServerActionRequest(request);

  // Skip Auth round-trip on public pages when there is no session cookie.
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  if (!hasSupabaseAuthCookie && publicPath) {
    return supabaseResponse;
  }

  // Login/sign-in actions must not wait on getUser(). A dead or slow Auth host
  // otherwise blocks SIGN IN for 40s+ before signInAction even runs.
  if (serverAction && publicPath) {
    return supabaseResponse;
  }

  // Login page should always render immediately. Stale auth cookies + Auth
  // outages previously made GET /login hang (~40s) before the form was usable.
  if (!serverAction && (pathname === "/login" || pathname.startsWith("/login/"))) {
    return supabaseResponse;
  }

  // Do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Refresh cookies only — never redirect Server Action POSTs.
  if (serverAction) {
    return supabaseResponse;
  }

  if (!user && !publicPath) {
    if (isCronPath(pathname) && authorizeCronRequest(request)) {
      return supabaseResponse;
    }

    if (isApiPath(pathname)) {
      const unauthorized = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      copyResponseCookies(supabaseResponse, unauthorized);
      return unauthorized;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", nextPath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}
