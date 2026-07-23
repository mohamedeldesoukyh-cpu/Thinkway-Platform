"use client";

import { type MouseEvent, type ReactNode } from "react";

import { useDelayedHover } from "@/lib/hooks/use-delayed-hover";
import { cn } from "@/lib/utils";

import { CreatorDetailsHoverCard } from "./creator-details-hover-card";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type CreatorAvatarHoverTriggerProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  onOpenCreator?: () => void;
  children: ReactNode;
  className?: string;
};

export function CreatorAvatarHoverTrigger({
  creator,
  displayName,
  avatarUrl,
  profileUrl,
  thinkwayStarLabel,
  fallbackStatusLabel,
  onOpenCreator,
  children,
  className,
}: CreatorAvatarHoverTriggerProps) {
  const { open, setOpen, onPointerEnter, onPointerLeave, keepOpen, scheduleClose } =
    useDelayedHover(1000);

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const openCreatorFromPreview = () => {
    setOpen(false);
    onOpenCreator?.();
  };

  return (
    <div
      className={cn("discovery-creator-avatar-hover-trigger", className)}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={scheduleClose}
      onClick={stop}
    >
      {children}
      {open ? (
        <div
          className="discovery-creator-avatar-hover-trigger__panel"
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
        >
          <CreatorDetailsHoverCard
            creator={creator}
            displayName={displayName}
            avatarUrl={avatarUrl}
            profileUrl={profileUrl}
            thinkwayStarLabel={thinkwayStarLabel}
            fallbackStatusLabel={fallbackStatusLabel}
            onClick={onOpenCreator ? openCreatorFromPreview : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
