import { NextResponse } from "next/server";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
