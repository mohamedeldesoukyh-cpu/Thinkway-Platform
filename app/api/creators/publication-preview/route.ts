import { after, NextResponse } from "next/server";

import {
  refreshPublicationPreviewInBackground,
  resolvePublicationPreviewForHttpRequest,
} from "@/lib/creators/publication-preview-proxy";
import { recordMediaProxyRefreshScheduled } from "@/lib/creators/media-proxy-cache";
import { requireApiAnyPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSearchParamsWithSchema } from "@/lib/validation/http";
import { mediaProxyQuerySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
/** Keep high enough for `after()` background refresh (oEmbed / OpenGraph). */
export const maxDuration = 30;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiAnyPermission(supabase, [
    "discovery.read",
    "influencers.read",
    "publications.read",
    "campaigns.read",
  ]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsedQuery = parseSearchParamsWithSchema(searchParams, mediaProxyQuerySchema);
  if (!parsedQuery.ok) return parsedQuery.response;
  const src = parsedQuery.data.src ?? null;
  const postUrl = parsedQuery.data.postUrl ?? null;

  const result = await resolvePublicationPreviewForHttpRequest({ src, postUrl });
  if (result.needsRefresh) {
    recordMediaProxyRefreshScheduled();
    after(() => refreshPublicationPreviewInBackground({ src, postUrl }));
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "Preview unavailable." },
      {
        status: result.status,
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Preview-Cache": result.source,
        },
      }
    );
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Preview-Cache": result.source,
      ...(result.needsRefresh ? { "X-Preview-Upgrade": "1" } : {}),
    },
  });
}
