import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";

import {
  avatarProfileUrlForReview,
  profileUrlForPlatform,
} from "./platform-breakdown";
import type { ClientContentPost, ClientReviewSourceSnapshot } from "./types";

function normalizeMediaUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const decoded = decodeHtmlEntities(trimmed);
  return decoded || trimmed;
}

export function reviewMediaAllowlist(snapshot: ClientReviewSourceSnapshot | null | undefined): Set<string> {
  const urls = new Set<string>();
  if (!snapshot) return urls;
  for (const creator of snapshot.creators) {
    addUrl(urls, creator.avatarUrl);
    addUrl(urls, creator.profileUrl);
    addUrl(urls, avatarProfileUrlForReview(creator));
    for (const account of creator.platformAccounts ?? []) {
      addUrl(urls, account.profileUrl);
      addUrl(
        urls,
        profileUrlForPlatform(account.platform, account.handle, account.profileUrl)
      );
    }
    for (const post of creator.contentFeed ?? []) {
      addUrl(urls, post.thumbnail);
      addUrl(urls, post.url);
    }
  }
  return urls;
}

function addUrl(urls: Set<string>, value?: string | null) {
  const normalized = normalizeMediaUrl(value);
  if (!normalized) return;
  urls.add(normalized);
  if (value?.trim() && value.trim() !== normalized) urls.add(value.trim());
}

export function allowlistedReviewMediaUrl(
  allowlist: Set<string>,
  value?: string | null
): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  if (allowlist.has(trimmed)) return trimmed;
  const normalized = normalizeMediaUrl(trimmed);
  if (normalized && allowlist.has(normalized)) return normalized;
  return null;
}

export function isReviewMediaUrlAllowed(
  allowlist: Set<string>,
  src?: string | null,
  postUrl?: string | null,
  profileUrl?: string | null
): boolean {
  return Boolean(
    allowlistedReviewMediaUrl(allowlist, src) ||
      allowlistedReviewMediaUrl(allowlist, postUrl) ||
      allowlistedReviewMediaUrl(allowlist, profileUrl)
  );
}

export function clientReviewMediaPath(
  token: string,
  input: {
    kind: "avatar" | "publication";
    src?: string | null;
    postUrl?: string | null;
    profileUrl?: string | null;
  }
): string | undefined {
  const src = input.src?.trim() || "";
  const postUrl = input.postUrl?.trim() || "";
  const profileUrl = input.profileUrl?.trim() || "";
  if (!src && !postUrl && !profileUrl) return undefined;
  if (src.startsWith("/api/review/media")) return src;
  if (src && !postUrl && !profileUrl && !shouldProxyPublicationMediaUrl(src) && !src.startsWith("/api/")) {
    return src;
  }
  const params = new URLSearchParams();
  params.set("sign", token);
  params.set("kind", input.kind);
  if (src) params.set("src", src);
  if (postUrl) params.set("postUrl", postUrl);
  if (profileUrl) params.set("profileUrl", profileUrl);
  return `/api/review/media?${params.toString()}`;
}

export function clientReviewAvatarUrl(
  token: string,
  src?: string | null,
  profileUrl?: string | null
): string | undefined {
  return clientReviewMediaPath(token, { kind: "avatar", src, profileUrl });
}

export function clientReviewPostDisplay(
  token: string,
  post: ClientContentPost
): { thumbnail?: string; href?: string } {
  return {
    thumbnail: clientReviewMediaPath(token, {
      kind: "publication",
      src: post.thumbnail,
      postUrl: post.url,
    }),
    href: post.url ?? undefined,
  };
}
