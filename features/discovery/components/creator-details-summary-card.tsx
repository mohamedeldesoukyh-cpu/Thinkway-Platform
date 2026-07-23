"use client";

import { SparklesIcon, StarIcon } from "lucide-react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { formatThinkwayStarLabel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { cn } from "@/lib/utils";

export { formatThinkwayStarLabel };

export type CreatorDetailsSummaryCardProps = {
  displayName: string;
  avatarUrl: string | null;
  profileUrl?: string | null;
  thinkwayStarLabel: string;
  secondaryLine: string;
  statusLabel?: string | null;
  countryCodes?: string[];
  countryLabel?: string | null;
  className?: string;
  onClick?: () => void;
  /** compact = search hover; sheet = detail panel header; rail = similar creators sidebar */
  size?: "compact" | "sheet" | "rail";
};

export function CreatorDetailsSummaryCard({
  displayName,
  avatarUrl,
  profileUrl = null,
  thinkwayStarLabel,
  secondaryLine,
  statusLabel,
  countryCodes = [],
  countryLabel,
  className,
  onClick,
  size = "compact",
}: CreatorDetailsSummaryCardProps) {
  const Tag = onClick ? "button" : "div";
  const isSheet = size === "sheet";
  const isRail = size === "rail";
  const avatarSizeClass = isSheet ? "size-[72px]" : isRail ? "size-[40px]" : "size-[52px]";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      aria-label={onClick ? `Open ${displayName} creator profile` : undefined}
      className={cn(
        "discovery-creator-details-hover-card w-full text-left",
        isSheet && "discovery-creator-details-hover-card--sheet",
        isRail && "discovery-creator-details-hover-card--rail",
        onClick &&
          "cursor-pointer transition-shadow hover:shadow-[0_12px_36px_rgba(0,87,255,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40",
        className
      )}
    >
      <div className="discovery-creator-details-hover-card__avatar-wrap relative">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${displayName} profile`}
            className="block shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
            onClick={(event) => event.stopPropagation()}
          >
            <CreatorAvatarImage
              avatarUrl={avatarUrl}
              profileUrl={profileUrl}
              alt={displayName}
              sizeClassName={avatarSizeClass}
              className="discovery-creator-details-hover-card__avatar"
            />
          </a>
        ) : (
          <CreatorAvatarImage
            avatarUrl={avatarUrl}
            profileUrl={profileUrl}
            alt={displayName}
            sizeClassName={avatarSizeClass}
            className="discovery-creator-details-hover-card__avatar"
          />
        )}
        <span className="discovery-creator-details-hover-card__rating">
          <StarIcon aria-hidden className="size-3 fill-current" />
          {thinkwayStarLabel}
        </span>
        {countryCodes.length > 0 ? (
          <span className="absolute -right-1 -bottom-1">
            <CountryFlagsStack countryCodes={countryCodes} size="sm" overlay />
          </span>
        ) : null}
      </div>

      <div className="discovery-creator-details-hover-card__body">
        <div className="discovery-creator-details-hover-card__title-row">
          <span className="discovery-creator-details-hover-card__name">{displayName}</span>
          <SparklesIcon
            aria-hidden
            className={cn(
              "discovery-creator-details-hover-card__sparkle shrink-0",
              isRail ? "size-3" : "size-4"
            )}
          />
        </div>
        <p className="discovery-creator-details-hover-card__collabs">{secondaryLine}</p>
        {countryLabel ? (
          <p className="discovery-creator-details-hover-card__status">{countryLabel}</p>
        ) : null}
        {statusLabel ? (
          <p className="discovery-creator-details-hover-card__status">{statusLabel}</p>
        ) : null}
      </div>
    </Tag>
  );
}
