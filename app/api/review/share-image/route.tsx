import { ImageResponse } from "next/og";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { fetchWithStrictRedirects } from "@/lib/security/ssrf";
import { loadSharePreview, SHARE_COVER_BUCKET } from "@/features/client-workspace/share-preview-server";
import { loadIdentityLogoForReview } from "@/features/client-workspace/identity-logo";
import { SharePreviewCard } from "@/features/client-workspace/components/share-preview-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

async function safeLogo(url?: string) {
  if (!url) return null;
  try {
    const hosts = [process.env.NEXT_PUBLIC_SUPABASE_URL, "https://app.thinkwaymedia.com", "https://dev.thinkwaymedia.com"]
      .filter(Boolean).map((value) => new URL(value!).hostname);
    const response = await fetchWithStrictRedirects(url, { allowlist: { exact: hosts, suffixes: [] }, timeoutMs: 2500, maxRedirects: 1 });
    if (!response.ok || !response.body) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return `data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const preview = await loadSharePreview(query.get("reviewId") ?? "", query.get("sign") ?? "");
    if (!preview) return new Response("Preview unavailable", { status: 404, headers });
    const db = createServiceRoleClient();
    if (preview.coverPath) {
      const { data } = await db.storage.from(SHARE_COVER_BUCKET).download(preview.coverPath);
      if (data) return new Response(await data.arrayBuffer(), { headers: { ...headers, "Content-Type": "image/jpeg" } });
    }
    const identity = preview.review.sourceSnapshot?.identityLogo ?? await loadIdentityLogoForReview(db, preview.review);
    const logo = await safeLogo(identity?.url);
    return new ImageResponse(<SharePreviewCard campaignName={preview.campaignName} clientLabel={preview.review.clientLabel} logo={logo} />,
      { width: 1200, height: 630, headers });
  } catch {
    return new Response("Preview unavailable", { status: 503, headers });
  }
}
