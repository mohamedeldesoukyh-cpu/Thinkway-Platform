import { resolveIoPublicAppOrigin } from "@/lib/io/io-public-app-url";
import { loadSharePreview } from "@/features/client-workspace/share-preview-server";
import { campaignShareHtml } from "@/features/client-workspace/share-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await context.params;
  const query = new URL(request.url).searchParams;
  const token = query.get("sign")?.trim() ?? "";
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const preview = await loadSharePreview(reviewId, token);
    if (!preview) return new Response("Client link unavailable.", { status: 404, headers });
    return new Response(campaignShareHtml({
      campaignName: preview.campaignName, reviewId, token,
      origin: resolveIoPublicAppOrigin(),
      version: query.get("preview")?.slice(0, 64) || preview.version,
    }), { headers });
  } catch {
    return new Response("Could not load this client link. Please try again.", { status: 503, headers });
  }
}
