import { after, NextResponse } from "next/server";

import { resolveCreatorAvatarForHttpRequest, refreshCreatorAvatarInBackground } from "@/lib/creators/creator-avatar-proxy";
import {
  refreshPublicationPreviewInBackground,
  resolvePublicationPreviewForHttpRequest,
} from "@/lib/creators/publication-preview-proxy";
import { recordMediaProxyRefreshScheduled } from "@/lib/creators/media-proxy-cache";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { resolveClientReviewByToken } from "@/features/client-workspace/load-client-workspace";
import { isReviewMediaUrlAllowed, reviewMediaAllowlist } from "@/features/client-workspace/review-media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("sign")?.trim() || "";
  if (token.length < 16) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }

  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: 503 });
  }

  const resolved = await resolveClientReviewByToken(service, token);
  if (!resolved.ok) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }

  const kind = searchParams.get("kind") === "avatar" ? "avatar" : "publication";
  const src = searchParams.get("src");
  const postUrl = searchParams.get("postUrl");
  const allowlist = reviewMediaAllowlist(resolved.review.sourceSnapshot);
  if (!isReviewMediaUrlAllowed(allowlist, src, postUrl)) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
  }
  const allowedSrc = src?.trim() && allowlist.has(src.trim()) ? src.trim() : null;
  const allowedPostUrl = postUrl?.trim() && allowlist.has(postUrl.trim()) ? postUrl.trim() : null;

  if (kind === "avatar") {
    if (!allowedSrc) {
      return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
    }
    const result = await resolveCreatorAvatarForHttpRequest({ src: allowedSrc, supabase: service });
    if (!result.ok) {
      if (result.needsRefresh) {
        recordMediaProxyRefreshScheduled();
        after(() => refreshCreatorAvatarInBackground({ src: allowedSrc, supabase: service }));
      }
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

  const result = await resolvePublicationPreviewForHttpRequest({
    src: allowedSrc,
    postUrl: allowedPostUrl,
  });
  if (!result.ok) {
    if (result.needsRefresh) {
      recordMediaProxyRefreshScheduled();
      after(() => refreshPublicationPreviewInBackground({ src: allowedSrc, postUrl: allowedPostUrl }));
    }
    return NextResponse.json({ error: "Preview unavailable." }, { status: result.status });
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Preview-Cache": result.source,
    },
  });
}
