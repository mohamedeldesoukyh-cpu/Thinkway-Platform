import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";

import type { ClientContentPost, ClientReviewSourceSnapshot } from "./types";

export function reviewMediaAllowlist(snapshot: ClientReviewSourceSnapshot | null | undefined): Set<string> {
  const urls = new Set<string>();
  if (!snapshot) return urls;
  for (const creator of snapshot.creators) {
    addUrl(urls, creator.avatarUrl);
    for (const post of creator.contentFeed ?? []) {
      addUrl(urls, post.thumbnail);
      addUrl(urls, post.url);
    }
  }
  return urls;
}

function addUrl(urls: Set<string>, value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed) urls.add(trimmed);
}

export function isReviewMediaUrlAllowed(
  allowlist: Set<string>,
  src?: string | null,
  postUrl?: string | null
): boolean {
  const source = src?.trim() || "";
  const post = postUrl?.trim() || "";
  if (!source && !post) return false;
  if (source && allowlist.has(source)) return true;
  if (post && allowlist.has(post)) return true;
  return false;
}

export function clientReviewMediaPath(
  token: string,
  input: { kind: "avatar" | "publication"; src?: string | null; postUrl?: string | null }
): string | undefined {
  const src = input.src?.trim() || "";
  const postUrl = input.postUrl?.trim() || "";
  if (!src && !postUrl) return undefined;
  if (src.startsWith("/api/review/media")) return src;
  if (src && !postUrl && !shouldProxyPublicationMediaUrl(src) && !src.startsWith("/api/")) {
    return src;
  }
  const params = new URLSearchParams();
  params.set("sign", token);
  params.set("kind", input.kind);
  if (src) params.set("src", src);
  if (postUrl) params.set("postUrl", postUrl);
  return `/api/review/media?${params.toString()}`;
}

export function clientReviewAvatarUrl(token: string, src?: string | null): string | undefined {
  return clientReviewMediaPath(token, { kind: "avatar", src });
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
