import { NextResponse } from "next/server";

import { fetchPublicationPreviewImage } from "@/lib/creators/publication-preview-proxy";
import { requireApiAnyPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
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
  const src = searchParams.get("src");
  const postUrl = searchParams.get("postUrl");

  if (!src && !postUrl) {
    return NextResponse.json({ error: "Missing preview source." }, { status: 400 });
  }

  const result = await fetchPublicationPreviewImage({ src, postUrl });
  if (!result.ok) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: result.status });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
