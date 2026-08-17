"use client";

import { useState } from "react";

import {
  CONTENT_UNAVAILABLE,
  CONTENT_UNAVAILABLE_DETAIL,
  formatCompactCount,
  formatEngagementPct,
  formatPlatformLabel,
  NOT_AVAILABLE,
} from "../format";
import type { ClientContentPost } from "../types";

export function CreatorContentFeed({ posts }: { posts: ClientContentPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-zinc-700">{CONTENT_UNAVAILABLE}</p>
        <p className="mt-1 text-sm text-zinc-500">{CONTENT_UNAVAILABLE_DETAIL}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {posts.map((post, index) => (
        <ContentTile key={`${post.url ?? post.thumbnail ?? index}`} post={post} />
      ))}
    </div>
  );
}

function ContentTile({ post }: { post: ClientContentPost }) {
  const [failed, setFailed] = useState(false);
  const href = post.url ?? undefined;
  const showImage = Boolean(post.thumbnail) && !failed;
  const inner = (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="aspect-square bg-zinc-100">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail!}
            alt=""
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-xs font-semibold text-zinc-500">
            {formatPlatformLabel(post.platform) || "Content"}
          </div>
        )}
      </div>
      <div className="space-y-0.5 p-2.5 text-[11px] text-zinc-600">
        <p className="font-medium text-zinc-800">{formatPlatformLabel(post.platform) || "Post"}</p>
        {post.postedAt ? <p>{new Date(post.postedAt).toLocaleDateString()}</p> : null}
        <p>
          {post.likes != null ? `${formatCompactCount(post.likes)} likes` : NOT_AVAILABLE} ·{" "}
          {post.comments != null ? `${formatCompactCount(post.comments)} comments` : NOT_AVAILABLE}
        </p>
        <p>
          {post.views != null ? `${formatCompactCount(post.views)} views` : NOT_AVAILABLE}
          {post.engagementRate != null ? ` · ER ${formatEngagementPct(post.engagementRate)}` : ""}
        </p>
      </div>
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
