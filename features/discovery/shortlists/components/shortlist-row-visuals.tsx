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
  align = "end",
  overflowVariant = "muted",
}: {
  previews: ShortlistCreatorPreview[];
  totalCount: number;
  className?: string;
  align?: "start" | "end";
  overflowVariant?: "muted" | "solid";
}) {
  if (totalCount === 0) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">0</span>
    );
  }

  const visible = previews.slice(0, 4);
  const overflow = totalCount - visible.length;

  return (
    <div
      className={cn(
        "flex items-center",
        align === "start" ? "justify-start" : "justify-end",
        className
      )}
    >
      {visible.length > 0 ? (
        <div className="flex items-center" aria-hidden>
          {visible.map((preview, index) => {
            const palette = gradientForIndex(index);
            const hasImage = Boolean(preview.profile_image_url?.trim());
            return (
              <span
                key={`${preview.display_name}-${index}`}
                className={cn(
                  /* HTML `.creator-chip`: 26px, border 2px white, overlap -8px */
                  "relative inline-flex size-[26px] overflow-hidden rounded-full border-2 border-white bg-[var(--surface)]",
                  "dark:border-background",
                  index > 0 && "-ml-2"
                )}
                style={{ zIndex: visible.length - index }}
              >
                {hasImage ? (
                  <CreatorAvatarImage
                    avatarUrl={preview.profile_image_url}
                    sizeClassName="size-[26px]"
                    className="rounded-full"
                  />
                ) : (
                  <span
                    className={cn(
                      "flex size-[26px] items-center justify-center bg-gradient-to-br text-[9px] font-bold",
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
                "relative -ml-2 inline-flex size-[26px] items-center justify-center rounded-full border-2 border-white text-[9px] font-bold dark:border-background",
                overflowVariant === "solid"
                  ? "bg-[var(--ink)] text-white"
                  : "border-dashed border-border bg-muted/80 font-medium text-muted-foreground"
              )}
              style={{ zIndex: 0 }}
            >
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        className={cn(
          "ml-2 text-[10.5px] font-bold tabular-nums",
          overflowVariant === "solid"
            ? "text-[var(--text-3)]"
            : "text-foreground"
        )}
      >
        {totalCount}
      </span>
    </div>
  );
}
