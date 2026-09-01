import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";
import {
  SOCIAL_MEDIA_SRC_ALLOWLIST,
  SOCIAL_POST_ALLOWLIST,
  fetchWithStrictRedirects,
  isUrlAllowedByHostlist,
} from "@/lib/security/ssrf";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";

type Ctx = {
  contentUrl: string | null;
};

/** Decode HTML entities in og:image (Facebook emits `&amp;` in query strings). */
export function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+property=["']og:video:poster["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const decoded = decodeHtmlEntities(match[1].trim());
    if (decoded.startsWith("http")) return decoded;
  }
  return null;
}

export async function tryOpenGraphThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.contentUrl) {
    return {
      source: "opengraph",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  if (!isUrlAllowedByHostlist(ctx.contentUrl, SOCIAL_POST_ALLOWLIST)) {
    return {
      source: "opengraph",
      available: true,
      error: "URL host is not allowlisted.",
      errorCode: "opengraph_host_blocked",
      durationMs: Date.now() - started,
    };
  }

  const isFacebook =
    /(?:^|\.)(?:facebook\.com|fb\.com|fb\.watch)$/i.test(
      (() => {
        try {
          return new URL(ctx.contentUrl).hostname;
        } catch {
          return "";
        }
      })()
    );

  try {
    const response = await fetchWithStrictRedirects(ctx.contentUrl, {
      allowlist: SOCIAL_POST_ALLOWLIST,
      maxRedirects: 3,
      timeoutMs: 30_000,
      headers: {
        "User-Agent": isFacebook
          ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
          : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!response.ok) {
      return {
        source: "opengraph",
        available: true,
        error: `HTTP ${response.status}`,
        errorCode: "opengraph_http_error",
        durationMs: Date.now() - started,
      };
    }
    const html = await response.text();
    const imageUrl = extractOgImage(html);
    if (!imageUrl) {
      return {
        source: "opengraph",
        available: true,
        error: "No og:image found.",
        errorCode: "opengraph_empty",
        durationMs: Date.now() - started,
      };
    }
    if (!isUrlAllowedByHostlist(imageUrl, SOCIAL_MEDIA_SRC_ALLOWLIST)) {
      return {
        source: "opengraph",
        available: true,
        error: "og:image host is not allowlisted.",
        errorCode: "opengraph_image_blocked",
        durationMs: Date.now() - started,
      };
    }
    return {
      source: "opengraph",
      available: true,
      imageUrl,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "opengraph",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "opengraph_error",
      durationMs: Date.now() - started,
    };
  }
}
