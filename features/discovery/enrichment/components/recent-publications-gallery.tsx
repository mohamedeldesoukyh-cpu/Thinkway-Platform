"use client";

import { ExternalLinkIcon, HeartIcon, MessageCircleIcon, PlayIcon } from "lucide-react";

import type { CreatorRecentPublication } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatPostedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function captionSnippet(caption: string | null | undefined): string {
  if (!caption?.trim()) return "No caption";
  const trimmed = caption.trim().replace(/\s+/g, " ");
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
}

function PublicationCard({ publication }: { publication: CreatorRecentPublication }) {
  const content = (
    <>
      <div className="relative aspect-square overflow-hidden bg-muted">
        {publication.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publication.thumbnail}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[11px] text-muted-foreground">
            No preview
          </div>
        )}
        {publication.url ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLinkIcon className="size-3" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {captionSnippet(publication.caption)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="size-3" aria-hidden />
            {formatCount(publication.likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleIcon className="size-3" aria-hidden />
            {formatCount(publication.comments)}
          </span>
          {publication.views != null ? (
            <span className="inline-flex items-center gap-1">
              <PlayIcon className="size-3" aria-hidden />
              {formatCount(publication.views)}
            </span>
          ) : null}
        </div>
        <p className="text-[10px] text-muted-foreground/80">{formatPostedAt(publication.posted_at)}</p>
      </div>
    </>
  );

  if (publication.url) {
    return (
      <a
        href={publication.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/30"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-border/60 bg-card">{content}</div>
  );
}

export function RecentPublicationsGallery({
  publications,
  className,
}: {
  publications: CreatorRecentPublication[];
  className?: string;
}) {
  if (publications.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-[12px] text-muted-foreground">
        No recent publications yet. Refresh metrics to collect latest posts.
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {publications.map((publication, index) => (
        <PublicationCard
          key={publication.url ?? publication.thumbnail ?? `pub-${index}`}
          publication={publication}
        />
      ))}
    </div>
  );
}
