import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match app routes that need session refresh / auth gates.
     * Skip static assets, Next internals, and public health probes.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|api/health|api/ready|api/version|api/build-info|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
