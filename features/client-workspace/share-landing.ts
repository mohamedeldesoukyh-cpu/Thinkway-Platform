import { SHARE_DESCRIPTION, shareImagePath } from "./share-preview";

/** Keep the original signed destination; the share route only supplies crawler metadata. */
export function campaignShareUrl(reviewUrl: string, version = "3"): string {
  const url = new URL(reviewUrl);
  const match = url.pathname.match(/^\/review\/([^/]+)(?:\/.*)?$/);
  if (!match || !url.searchParams.get("sign")) return reviewUrl;
  url.pathname = `/review/${match[1]}/share`;
  url.searchParams.set("preview", version);
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
</head><body><h1>${title}</h1><p>Opening your campaign…</p>
<a href="${escapeHtml(destination.href)}">Open campaign</a>
<script>window.location.replace(${redirect});</script></body></html>`;
}
