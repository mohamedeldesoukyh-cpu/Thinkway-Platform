import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { parseCompactCount } from "@/lib/social/parse-compact-count";

import {
  API_METRICS_PLATFORMS,
} from "../metrics-status";
import {
  emptyEnrichment,
  mergeEnrichment,
  type EnrichmentContext,
  type EnrichmentResult,
  type ProfileEnrichmentProvider,
} from "../types";

const FETCH_TIMEOUT_MS = 8000;

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function parseCountsFromHtml(html: string): {
  follower_count: number | null;
  following_count: number | null;
} {
  const subscriberMatch = html.match(/"subscriberCountText":\s*"([^"]+)"/i);
  if (subscriberMatch) {
    return {
      follower_count: parseCompactCount(subscriberMatch[1]),
      following_count: null,
    };
  }

  const subscriberJsonMatch = html.match(/"subscriberCount":\s*"(\d+)"/i);
  if (subscriberJsonMatch) {
    return {
      follower_count: Number(subscriberJsonMatch[1]),
      following_count: null,
    };
  }

  const followerMatch =
    html.match(/"followerCount"\s*:\s*"?([\d,]+)"?/i) ??
    html.match(/([\d,.]+[kmb]?)\s+followers/i);
  const followingMatch =
    html.match(/"followingCount"\s*:\s*"?([\d,]+)"?/i) ??
    html.match(/([\d,.]+[kmb]?)\s+following/i);

  return {
    follower_count: followerMatch ? parseCompactCount(followerMatch[1]) : null,
    following_count: followingMatch ? parseCompactCount(followingMatch[1]) : null,
  };
}

async function fetchPublicHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; ThinkwayBot/1.0; +https://thinkway.app)",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, 500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export class OpenGraphEnrichmentProvider implements ProfileEnrichmentProvider {
  readonly id = "open_graph";

  supports(): boolean {
    return true;
  }

  async enrich(context: EnrichmentContext): Promise<Partial<EnrichmentResult>> {
    const html = await fetchPublicHtml(context.profile_url);
    if (!html) {
      return {
        sync_status: "partial",
        sync_source: this.id,
        sync_error: "Public profile page could not be fetched.",
        messages: ["Profile URL detected — public stats unavailable right now."],
      };
    }

    const title = extractMetaContent(html, "og:title");
    const description = extractMetaContent(html, "og:description");
    const image = extractMetaContent(html, "og:image");
    const counts = parseCountsFromHtml(html);

    const hasStats =
      counts.follower_count != null || counts.following_count != null;
    const hasMeta = Boolean(title || description || image);
    const needsApi =
      !hasStats && API_METRICS_PLATFORMS.includes(context.platform);

    return {
      display_name: title,
      bio: description,
      profile_picture_url: image,
      follower_count: counts.follower_count,
      following_count: counts.following_count,
      sync_status: hasStats
        ? "synced"
        : needsApi
          ? "pending_api"
          : hasMeta
            ? "partial"
            : "failed",
      sync_source: this.id,
      sync_error: hasStats || hasMeta ? null : "No public metadata found.",
      messages: hasStats
        ? [
            `${context.platform} profile enriched`,
            counts.follower_count != null
              ? `${formatCount(counts.follower_count)} followers synced`
              : "Profile metadata synced",
          ]
        : needsApi
          ? [
              `${context.platform} profile detected`,
              "Public metrics unavailable — API connection required",
            ]
          : hasMeta
            ? [`${context.platform} profile detected`, "Some public metadata synced"]
            : [`${context.platform} profile detected`, "Stats sync unavailable"],
    };
  }
}

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(value);
}

/** Reserved for future Meta Graph API integration. */
export class MetaGraphEnrichmentProvider implements ProfileEnrichmentProvider {
  readonly id = "meta_graph";

  supports(context: EnrichmentContext): boolean {
    return context.platform === "instagram" && Boolean(process.env.META_GRAPH_ACCESS_TOKEN);
  }

  async enrich(): Promise<Partial<EnrichmentResult>> {
    return {
      sync_source: this.id,
      messages: ["Meta Graph API provider not configured yet."],
    };
  }
}

const defaultProviders: ProfileEnrichmentProvider[] = [
  new MetaGraphEnrichmentProvider(),
  new OpenGraphEnrichmentProvider(),
];

export async function enrichCreatorProfile(
  context: EnrichmentContext,
  providers: ProfileEnrichmentProvider[] = defaultProviders
): Promise<EnrichmentResult> {
  let result = emptyEnrichment("url_parse");
  result.sync_status = "pending";
  result.messages = [`${context.platform} profile detected`];

  for (const provider of providers) {
    if (!provider.supports(context)) continue;

    try {
      const patch = await provider.enrich(context);
      result = mergeEnrichment(result, patch);
      if (result.sync_status === "synced") break;
    } catch (error) {
      result = mergeEnrichment(result, {
        sync_status: "partial",
        sync_error:
          error instanceof Error ? error.message : "Enrichment provider failed.",
        messages: ["Enrichment provider failed — manual entry still available."],
      });
    }
  }

  if (result.sync_status === "pending") {
    result.sync_status = "partial";
    result.sync_error = "No enrichment provider returned data.";
  }

  return result;
}
