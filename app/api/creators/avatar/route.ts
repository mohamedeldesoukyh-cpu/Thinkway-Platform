import { NextResponse } from "next/server";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "influencers.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  const profileUrl = searchParams.get("profileUrl");

  if (!src && !profileUrl) {
    return NextResponse.json({ error: "Missing avatar source." }, { status: 400 });
  }

  const result = await fetchCreatorAvatarImage({ src, profileUrl });
  if (!result.ok) {
    return NextResponse.json({ error: "Avatar unavailable." }, { status: result.status });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
