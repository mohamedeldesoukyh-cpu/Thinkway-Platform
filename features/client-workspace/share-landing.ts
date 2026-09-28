import { SHARE_DESCRIPTION, shareImagePath } from "./share-preview";

/** Keep the original signed destination; the share route only supplies crawler metadata. */
export function campaignShareUrl(reviewUrl: string, version = "3"): string {
  const url = new URL(reviewUrl);
  const match = url.pathname.match(/^\/review\/([^/]+)(?:\/.*)?$/);
  if (!match || !url.searchParams.get("sign")) return reviewUrl;
  const previewVersion = version.trim().slice(0, 64) || "3";
  // WhatsApp may retain a failed card for a route even when its query changes.
  // A versioned path creates a new crawler cache key while preserving the signed
  // token and the original client-review destination.
  url.pathname = `/review/${encodeURIComponent(match[1])}/share/${encodeURIComponent(previewVersion)}`;
  url.searchParams.delete("preview");
  return url.href;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function campaignShareHtml(input: {
  campaignName: string; reviewId: string; token: string; origin: string; version: string;
}): string {
  const title = escapeHtml(input.campaignName.trim() || "Your campaign · Thinkway");
  const destination = new URL(`/review/${encodeURIComponent(input.reviewId)}`, input.origin);
  destination.searchParams.set("sign", input.token);
  const shareUrl = escapeHtml(campaignShareUrl(destination.href, input.version));
  const image = escapeHtml(new URL(shareImagePath(input.reviewId, input.token, input.version), input.origin).href);
  // JSON escaping prevents a signed value from closing the script element.
  const redirect = JSON.stringify(destination.href).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${SHARE_DESCRIPTION}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Thinkway">
<meta property="og:url" content="${shareUrl}">
<meta name="description" content="${SHARE_DESCRIPTION}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:image" content="${image}">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#0a1020;font-family:Arial,sans-serif}
main{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px;text-align:center}
.logo{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;letter-spacing:-.4px}.logo span{color:#0057ff}
.mark{position:relative;width:36px;height:36px;border-radius:9px;background:#0a1020;animation:thinkway-loader-spin 1.1s linear infinite}
.mark:before{content:"";position:absolute;top:8px;left:8px;width:10px;height:10px;border-radius:50%;background:white}
.mark:after{content:"";position:absolute;right:6px;bottom:6px;width:14px;height:14px;border-radius:4px;background:#0057ff}
@keyframes thinkway-loader-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.mark{animation:none}}
a{color:#0057ff;font-size:14px;text-underline-offset:4px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style></head><body><main>
<div role="status" aria-live="polite" aria-label="Opening your campaign"><div class="logo" aria-hidden="true"><div class="mark"></div><div>THINK<span>WAY</span></div></div><span class="sr-only">Opening your campaign…</span></div>
<a href="${escapeHtml(destination.href)}">Open campaign</a></main>
<script>window.location.replace(${redirect});</script></body></html>`;
}
