"use client";

import { deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { platformBadgeClass } from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import { deliverableLabel } from "@/features/campaigns/line-assignment";
import { platformShortLabel } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { cn } from "@/lib/utils";

const DELIVERABLE_TAG_COLORS: Record<string, string> = {
  instagram_post: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  instagram_reel: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  instagram_story: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  instagram_live: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  tiktok_video: "bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100",
  tiktok_story: "bg-slate-800/10 text-slate-800 dark:text-slate-200",
  tiktok_live: "bg-slate-700/10 text-slate-700 dark:text-slate-300",
  snapchat_story: "bg-yellow-400/20 text-yellow-900 dark:text-yellow-200",
  snapchat_spotlight: "bg-amber-400/20 text-amber-900 dark:text-amber-200",
  youtube_video: "bg-red-500/15 text-red-700 dark:text-red-300",
  youtube_short: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  youtube_dedicated: "bg-red-600/15 text-red-800 dark:text-red-300",
  other: "bg-muted text-muted-foreground",
};

type DeliverableTypeTagProps = {
  platform: string;
  deliverableType: string;
  className?: string;
};

export function DeliverableTypeTag({
  platform,
  deliverableType,
  className,
}: DeliverableTypeTagProps) {
  const label = deliverableTypeShortLabel(deliverableType);
  const color =
    DELIVERABLE_TAG_COLORS[deliverableType] ??
    platformBadgeClass(platform) ??
    DELIVERABLE_TAG_COLORS.other;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        color,
        className
      )}
      title={`${platformShortLabel(platform)} · ${deliverableLabel(deliverableType)}`}
    >
      {label}
    </span>
  );
}
