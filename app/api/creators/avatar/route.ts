import { after, NextResponse } from "next/server";

import {
  refreshCreatorAvatarInBackground,
  resolveCreatorAvatarForHttpRequest,
} from "@/lib/creators/creator-avatar-proxy";
import { recordMediaProxyRefreshScheduled } from "@/lib/creators/media-proxy-cache";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSearchParamsWithSchema } from "@/lib/validation/http";
import { mediaProxyQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
/** Keep high enough for `after()` background refresh (scrape / OpenGraph). */
export const maxDuration = 30;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "influencers.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsedQuery = parseSearchParamsWithSchema(searchParams, mediaProxyQuerySchema);
  if (!parsedQuery.ok) return parsedQuery.response;
  const src = parsedQuery.data.src ?? null;
  const profileUrl = parsedQuery.data.profileUrl ?? null;

  const result = await resolveCreatorAvatarForHttpRequest({ src, profileUrl, supabase });
  if (result.needsRefresh) {
    recordMediaProxyRefreshScheduled();
    after(() => refreshCreatorAvatarInBackground({ src, profileUrl, supabase }));
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "Avatar unavailable." },
      {
        status: result.status,
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Avatar-Cache": result.source,
        },
      }
    );
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Avatar-Cache": result.source,
      ...(result.needsRefresh ? { "X-Avatar-Upgrade": "1" } : {}),
    },
  });
}
