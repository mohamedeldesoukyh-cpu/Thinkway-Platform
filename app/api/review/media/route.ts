import { after, NextResponse } from "next/server";

import { fetchCreatorAvatarImage, resolveCreatorAvatarForHttpRequest } from "@/lib/creators/creator-avatar-proxy";
import { recordMediaProxyRefreshScheduled } from "@/lib/creators/media-proxy-cache";
import {
  fetchPublicationPreviewImage,
  refreshPublicationPreviewInBackground,
  resolvePublicationPreviewForHttpRequest,
} from "@/lib/creators/publication-preview-proxy";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { resolveClientReviewByToken } from "@/features/client-workspace/load-client-workspace";
import {
  allowlistedReviewMediaUrl,
  isReviewMediaUrlAllowed,
  resolveAllowedReviewMediaSrc,
  reviewMediaAllowlist,
} from "@/features/client-workspace/review-media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function imageResponse(
  buffer: ArrayBuffer,
  contentType: string,
  cacheSource?: string,
  upgrading?: boolean
) {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
  };
  if (cacheSource) headers["X-Preview-Cache"] = cacheSource;
  if (upgrading) headers["X-Preview-Upgrade"] = "1";
  return new NextResponse(buffer, { status: 200, headers });
}

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
  const profileUrl = searchParams.get("profileUrl");
  const allowlist = reviewMediaAllowlist(resolved.review.sourceSnapshot);
  if (!isReviewMediaUrlAllowed(allowlist, src, postUrl, profileUrl)) {
    return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
  }
  const allowedPostUrl = allowlistedReviewMediaUrl(allowlist, postUrl);
  const allowedProfileUrl = allowlistedReviewMediaUrl(allowlist, profileUrl);
  const allowedSrc = resolveAllowedReviewMediaSrc(allowlist, src, postUrl, profileUrl);

  if (kind === "avatar") {
    if (!allowedSrc && !allowedProfileUrl) {
      return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
    }
    const result = await resolveCreatorAvatarForHttpRequest({
      src: allowedSrc,
      profileUrl: allowedProfileUrl,
      supabase: service,
    });
    if (result.ok) {
      return imageResponse(result.buffer, result.contentType, result.source);
    }
    const refreshed = await fetchCreatorAvatarImage({
      src: allowedSrc,
      profileUrl: allowedProfileUrl,
      supabase: service,
    });
    if (refreshed.ok) {
      return imageResponse(refreshed.buffer, refreshed.contentType, "refresh");
    }
    return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
  }

  const result = await resolvePublicationPreviewForHttpRequest({
    src: allowedSrc,
    postUrl: allowedPostUrl,
  });
  if (result.needsRefresh) {
    recordMediaProxyRefreshScheduled();
    after(() =>
      refreshPublicationPreviewInBackground({
        src: allowedSrc,
        postUrl: allowedPostUrl,
      })
    );
  }
  if (result.ok) {
    return imageResponse(result.buffer, result.contentType, result.source, result.needsRefresh);
  }

  // Display-quality uses a separate cache key from sharp misses, so Client Workspace
  // tiles can still paint after a prior sharp-negative cache entry.
  const display = await fetchPublicationPreviewImage({
    src: allowedSrc,
    postUrl: allowedPostUrl,
    quality: "display",
  });
  if (display.ok) {
    return imageResponse(display.buffer, display.contentType, "refresh", true);
  }

  return NextResponse.json(
    { error: "Preview unavailable." },
    {
      status: 404,
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-Preview-Cache": result.source,
      },
    }
  );
}
