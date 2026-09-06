"use client";

import { ExternalLinkIcon, HeartIcon, MessageCircleIcon, PlayIcon } from "lucide-react";

import { PublicationPreviewImage } from "@/components/creator/publication-preview-image";
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

function PublicationCard({
  publication,
  variant,
  imageHeightClass,
}: {
  publication: CreatorRecentPublication;
  variant: "default" | "drawer";
  imageHeightClass?: string;
}) {
  const isDrawer = variant === "drawer";

  const content = isDrawer ? (
    <>
      <div
        className={cn(
          "relative overflow-hidden border-b border-border bg-muted/20",
          imageHeightClass ?? "h-[120px]"
        )}
      >
        <PublicationPreviewImage publication={publication} />
        {publication.url ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLinkIcon className="size-3" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="mb-0.5 line-clamp-1 text-[10px] text-muted-foreground">
          {captionSnippet(publication.caption)}
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <HeartIcon className="size-2.5" aria-hidden />
            {formatCount(publication.likes)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageCircleIcon className="size-2.5" aria-hidden />
            {formatCount(publication.comments)}
          </span>
          {publication.views != null ? (
            <span className="inline-flex items-center gap-0.5">
              <PlayIcon className="size-2.5" aria-hidden />
              {formatCount(publication.views)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatPostedAt(publication.posted_at)}</p>
      </div>
    </>
  ) : (
    <>
      <div className="relative aspect-square overflow-hidden bg-muted">
        <PublicationPreviewImage
          publication={publication}
          imgClassName="transition-transform group-hover:scale-[1.02]"
        />
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

  const cardClass = isDrawer
    ? "group overflow-hidden rounded-lg border border-border bg-muted/20 transition-colors hover:border-blue-300 dark:hover:border-blue-700"
    : "group block overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/30";

  if (publication.url) {
    return (
      <a href={publication.url} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {content}
      </a>
    );
  }

  return <div className={cn("group", cardClass)}>{content}</div>;
}

export function RecentPublicationsGallery({
  publications,
  className,
  variant = "default",
  columns = 2,
  imageHeightClass,
  limit,
}: {
  publications: CreatorRecentPublication[];
  className?: string;
  variant?: "default" | "drawer";
  columns?: 2 | 3;
  imageHeightClass?: string;
  limit?: number;
}) {
  const items = limit != null ? publications.slice(0, limit) : publications;

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-[12px] text-muted-foreground">
        No recent publications yet. Refresh metrics to collect latest posts.
      </p>
    );
  }

  const gridClass =
    variant === "drawer"
      ? columns === 3
        ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        : "grid grid-cols-1 gap-2 sm:grid-cols-2"
      : "grid grid-cols-1 gap-3 sm:grid-cols-2";

  return (
    <div className={cn(gridClass, className)}>
      {items.map((publication, index) => (
        <PublicationCard
          key={publication.url ?? publication.posted_at ?? `pub-${index}`}
          publication={publication}
          variant={variant}
          imageHeightClass={imageHeightClass}
        />
      ))}
    </div>
  );
}
