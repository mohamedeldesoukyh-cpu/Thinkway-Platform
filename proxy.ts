import { type NextRequest } from "next/server";

import {
  finalizeGuardedResponse,
  preAuthRequestGuard,
} from "@/lib/security/request-guard";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const blocked = preAuthRequestGuard(request);
  if (blocked) return blocked;

  const response = await updateSession(request);
  return finalizeGuardedResponse(request, response);
}

export const config = {
  matcher: [
    /*
     * Match app + API routes for session, rate limits, CSRF, and security headers.
     * Skip Next internals and static asset extensions.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
