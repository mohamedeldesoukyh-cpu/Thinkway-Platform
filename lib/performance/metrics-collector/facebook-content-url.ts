/**
 * Classify Facebook publication URLs for metrics acquisition.
 * Page/profile crawlers must not receive direct reel/post permalinks as startUrls.
 */

export type FacebookContentUrlKind =
  | "reel"
  | "post"
  | "video"
  | "photo"
  | "watch"
  | "share"
  | "page"
  | "unknown";

function pathnameOf(contentUrl: string): string | null {
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(contentUrl.trim()) ? contentUrl.trim() : `https://${contentUrl.trim()}`
    );
    return parsed.pathname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyFacebookContentUrl(
  contentUrl: string | null | undefined
): FacebookContentUrlKind {
  const raw = contentUrl?.trim();
  if (!raw) return "unknown";

  let host = "";
  let pathname = "";
  let search = "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    pathname = parsed.pathname.toLowerCase();
    search = parsed.search.toLowerCase();
  } catch {
    return "unknown";
  }

  if (host === "fb.watch" || host.endsWith(".fb.watch")) return "watch";

  if (pathname.includes("/reel/") || pathname.startsWith("/reel")) return "reel";
  if (pathname.includes("/share/r/") || pathname.includes("/share/v/")) return "share";
  if (pathname.includes("/share/p/") || pathname.includes("/share/")) return "share";
  if (pathname.includes("/watch") || search.includes("v=")) return "watch";
  if (pathname.includes("/videos/")) return "video";
  if (pathname.includes("/photo") || pathname.includes("/photos/")) return "photo";
  if (pathname.includes("/posts/") || pathname.includes("/permalink.php") || pathname.includes("/story.php")) {
    return "post";
  }

  // Bare page/profile path: /PageName or /profile.php
  const segments = pathname.split("/").filter(Boolean);
  if (pathname.includes("profile.php") || segments.length <= 1) return "page";

  return "unknown";
}

/** True when the URL identifies a single post/reel/video (not a page feed). */
export function isFacebookDirectContentUrl(contentUrl: string | null | undefined): boolean {
  const kind = classifyFacebookContentUrl(contentUrl);
  return (
    kind === "reel" ||
    kind === "post" ||
    kind === "video" ||
    kind === "photo" ||
    kind === "watch" ||
    kind === "share"
  );
}

export function facebookContentUrlKindLabel(kind: FacebookContentUrlKind): string {
  switch (kind) {
    case "reel":
      return "Facebook Reel";
    case "post":
      return "Facebook post";
    case "video":
      return "Facebook video";
    case "photo":
      return "Facebook photo";
    case "watch":
      return "Facebook watch";
    case "share":
      return "Facebook share link";
    case "page":
      return "Facebook page/profile";
    default:
      return "Facebook URL";
  }
}

/** Official Apify page/profile crawlers — not suitable for direct content permalinks. */
export function isFacebookPageProfileApifyActor(actorId: string | null | undefined): boolean {
  const id = (actorId ?? "").trim().toLowerCase();
  if (!id) return false;
  if (id === "apify/facebook-posts-scraper" || id.endsWith("/facebook-posts-scraper")) {
    return true;
  }
  if (id === "apify/facebook-pages-scraper" || id.endsWith("/facebook-pages-scraper")) {
    return true;
  }
  // Official reels actor harvests reels from a page URL, not a direct /reel/ permalink.
  if (id === "apify/facebook-reels-scraper" || id.endsWith("/facebook-reels-scraper")) {
    return true;
  }
  return false;
}

export function pathnameHint(contentUrl: string | null | undefined): string | null {
  return pathnameOf(contentUrl ?? "");
}
