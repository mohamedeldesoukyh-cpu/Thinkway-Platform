import { fetchPublicHtml } from "../browser/browser-pool.js";
import type { DiscoveryPlatform, PlatformCrawlResult } from "./types.js";
import {
  extractEmailFromBio,
  extractHashtags,
  extractMetaContent,
  parseCompactCount,
} from "./extractors.js";

function canonicalProfileUrl(platform: DiscoveryPlatform, username: string): string {
  const handle = username.replace(/^@+/, "").toLowerCase();
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "twitter":
      return `https://x.com/${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}

function parseOpenGraphProfile(
  platform: DiscoveryPlatform,
  username: string,
  html: string
): PlatformCrawlResult {
  const displayName = extractMetaContent(html, "og:title");
  const bio = extractMetaContent(html, "og:description");
  const profileImageUrl = extractMetaContent(html, "og:image");

  const followerMatch =
    html.match(/"followerCount"\s*:\s*"?([\d,]+)"?/i) ??
    html.match(/([\d,.]+[kmb]?)\s+followers/i);
  const followingMatch =
    html.match(/"followingCount"\s*:\s*"?([\d,]+)"?/i) ??
    html.match(/([\d,.]+[kmb]?)\s+following/i);

  const followers = parseCompactCount(followerMatch?.[1]);
  const following = parseCompactCount(followingMatch?.[1]);

  const mentioned = [...html.matchAll(/@([a-zA-Z0-9._]{2,30})/g)]
    .map((m) => m[1]!.toLowerCase())
    .filter((u) => u !== username.toLowerCase())
    .slice(0, 20);

  return {
    profile: {
      platform,
      username: username.toLowerCase(),
      profileUrl: canonicalProfileUrl(platform, username),
      displayName: displayName ?? undefined,
      bio: bio ?? undefined,
      profileImageUrl: profileImageUrl ?? undefined,
      followers,
      following,
      emailInBio: extractEmailFromBio(bio),
      metadata: { crawl_mode: "open_graph" },
    },
    posts: bio
      ? [
          {
            caption: bio,
            hashtags: extractHashtags(bio),
          },
        ]
      : [],
    relationships: mentioned.map((targetUsername) => ({
      targetUsername,
      relationshipType: "mention",
      strength: 1,
    })),
  };
}

export async function crawlPublicProfile(
  platform: DiscoveryPlatform,
  username: string
): Promise<PlatformCrawlResult> {
  const profileUrl = canonicalProfileUrl(platform, username);
  const html = await fetchPublicHtml(profileUrl);
  return parseOpenGraphProfile(platform, username, html);
}

export async function discoverUsernamesFromHashtagPage(
  platform: DiscoveryPlatform,
  hashtag: string,
  limit = 30
): Promise<string[]> {
  const tag = hashtag.replace(/^#+/, "");
  let url = "";
  switch (platform) {
    case "instagram":
      url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
      break;
    case "tiktok":
      url = `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;
      break;
    case "youtube":
      url = `https://www.youtube.com/hashtag/${encodeURIComponent(tag)}`;
      break;
    case "twitter":
      url = `https://x.com/hashtag/${encodeURIComponent(tag)}`;
      break;
  }

  const html = await fetchPublicHtml(url);
  const handles = new Set<string>();
  for (const match of html.matchAll(/@([a-zA-Z0-9._]{2,30})/g)) {
    handles.add(match[1]!.toLowerCase());
    if (handles.size >= limit) break;
  }
  for (const match of html.matchAll(/"username"\s*:\s*"([^"]+)"/gi)) {
    handles.add(match[1]!.toLowerCase());
    if (handles.size >= limit) break;
  }
  return [...handles].slice(0, limit);
}
