import { NextResponse } from "next/server";

import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { fetchBrandLogoImage, reviewBrandMentionAllowed } from "@/features/client-workspace/brand-logo";
import { resolveClientReviewByToken } from "@/features/client-workspace/load-client-workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("sign")?.trim() || "";
  const name = searchParams.get("name")?.trim() || "";
  if (token.length < 16 || !name) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }

  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    return NextResponse.json({ error: "Logo unavailable." }, { status: 503 });
  }

  const resolved = await resolveClientReviewByToken(service, token);
  if (!resolved.ok) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }

  const mention = reviewBrandMentionAllowed(resolved.review.sourceSnapshot, name);
  if (!mention) {
    return NextResponse.json({ error: "Logo unavailable." }, { status: 404 });
  }

  const result = await fetchBrandLogoImage(mention);
  if (!result) {
    return NextResponse.json({ error: "Logo unavailable." }, { status: 404 });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
