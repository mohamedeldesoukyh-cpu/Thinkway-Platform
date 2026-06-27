"use client";

import { useState } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

const THUMB_GRADIENTS = [
  "from-violet-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-emerald-600",
  "from-fuchsia-400 to-purple-500",
  "from-blue-400 to-blue-600",
] as const;

function gradientForName(name: string): (typeof THUMB_GRADIENTS)[number] {
  const sum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return THUMB_GRADIENTS[sum % THUMB_GRADIENTS.length];
}

export type CreatorThumbSize = 18 | 20 | 22 | 28 | 38;

const SIZE_CLASS: Record<CreatorThumbSize, string> = {
  18: "size-[18px] text-[8px]",
  20: "size-5 text-[8px]",
  22: "size-[22px] text-[8px]",
  28: "thinkway-campaign-cr-thumb thinkway-campaign-cr-thumb--vio",
  38: "thinkway-campaign-cr-thumb thinkway-campaign-cr-thumb--perf",
};

export function CreatorThumbAvatar({
  name,
  avatarUrl,
  platform,
  size,
  shape = "circle",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  platform?: string | null;
  size: CreatorThumbSize;
  shape?: "circle" | "rounded";
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = initialsFromCreatorName(name);
  const gradient = gradientForName(name);
  const showImage = Boolean(avatarUrl?.trim()) && !imageFailed;
  const sizeClass = SIZE_CLASS[size];
  const isDesignThumb = size === 28 || size === 38;
  const roundedClass =
    shape === "circle" && !isDesignThumb ? "rounded-full" : isDesignThumb ? "" : "rounded-[6px]";

  if (showImage) {
    return (
      <CreatorAvatarImage
        avatarUrl={avatarUrl}
        platform={platform}
        sizeClassName={cn(
          sizeClass,
          "shrink-0 object-cover",
          !isDesignThumb && roundedClass,
          className
        )}
        className={cn(!isDesignThumb && roundedClass, isDesignThumb && "border-0")}
        onFailed={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white",
        sizeClass,
        !isDesignThumb && roundedClass,
        isDesignThumb ? "" : "font-bold",
        gradient,
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
