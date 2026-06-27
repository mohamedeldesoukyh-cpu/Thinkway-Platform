"use client";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

import type { ShortlistCreatorPreview } from "../types";

const AVATAR_GRADIENTS = [
  {
    gradient: "from-sky-300/80 via-sky-400/45 to-blue-400/30",
    textClass: "text-sky-900 dark:text-sky-100",
  },
  {
    gradient: "from-amber-300/80 via-amber-400/45 to-orange-400/30",
    textClass: "text-amber-900 dark:text-amber-100",
  },
  {
    gradient: "from-rose-300/80 via-rose-400/45 to-pink-400/30",
    textClass: "text-rose-900 dark:text-rose-100",
  },
  {
    gradient: "from-violet-300/80 via-violet-400/45 to-purple-400/30",
    textClass: "text-violet-900 dark:text-violet-100",
  },
] as const;

function gradientForIndex(index: number) {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

function hashIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

type InitialsAvatarProps = {
  name: string;
  seed?: string;
  sizeClass?: string;
  textClass?: string;
  className?: string;
};

export function InitialsAvatar({
  name,
  seed,
  sizeClass = "size-10",
  className,
}: InitialsAvatarProps) {
  const palette = gradientForIndex(hashIndex(seed ?? name, AVATAR_GRADIENTS.length));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br text-[11px] font-semibold shadow-sm ring-2 ring-background",
        "dark:border-white/15",
        sizeClass,
        palette.gradient,
        palette.textClass,
        className
      )}
      aria-hidden
    >
      {initialsFromCreatorName(name)}
    </span>
  );
}

export function ShortlistCreatorPreviewStack({
  previews,
  totalCount,
  className,
}: {
  previews: ShortlistCreatorPreview[];
  totalCount: number;
  className?: string;
}) {
  if (totalCount === 0) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">0</span>
    );
  }

  const visible = previews.slice(0, 4);
  const overflow = totalCount - visible.length;

  return (
    <div className={cn("flex items-center justify-end gap-1.5", className)}>
      {visible.length > 0 ? (
        <div className="flex items-center" aria-hidden>
          {visible.map((preview, index) => {
            const palette = gradientForIndex(index);
            const hasImage = Boolean(preview.profile_image_url?.trim());
            return (
              <span
                key={`${preview.display_name}-${index}`}
                className={cn(
                  "relative inline-flex overflow-hidden rounded-full border border-white/80 ring-2 ring-background",
                  "dark:border-white/15",
                  index > 0 && "-ml-1.5",
                  "size-6"
                )}
                style={{ zIndex: visible.length - index }}
              >
                {hasImage ? (
                  <CreatorAvatarImage
                    avatarUrl={preview.profile_image_url}
                    sizeClassName="size-6"
                    className="rounded-full"
                  />
                ) : (
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center bg-gradient-to-br text-[9px] font-semibold",
                      palette.gradient,
                      palette.textClass
                    )}
                  >
                    {initialsFromCreatorName(preview.display_name)}
                  </span>
                )}
              </span>
            );
          })}
          {overflow > 0 ? (
            <span
              className={cn(
                "relative -ml-1.5 inline-flex size-6 items-center justify-center rounded-full",
                "border border-dashed border-border bg-muted/80 text-[9px] font-medium text-muted-foreground ring-2 ring-background"
              )}
              style={{ zIndex: 0 }}
            >
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : null}
      <span className="text-xs font-medium tabular-nums text-foreground">
        {totalCount}
      </span>
    </div>
  );
}
