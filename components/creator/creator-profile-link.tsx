"use client";

import Link from "next/link";
import { BadgeCheckIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import {
  type CountryFlagBadgeOverlaySize,
} from "@/components/creator/country-flag-badge";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CreatorProfileSource,
  creatorProfileSourceFromAccounts,
  creatorProfileSourceFromPlatformAccount,
  creatorProfileSourceFromUnified,
} from "@/lib/creators/creator-profile-source";
import {
  openOnPlatformTooltip,
  profileLinkTooltip,
  resolveCreatorProfileUrl,
  resolvePrimaryProfileUrl,
} from "@/lib/discovery/profile-url";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

export type { CreatorProfileSource };
export {
  creatorProfileSourceFromAccounts,
  creatorProfileSourceFromPlatformAccount,
  creatorProfileSourceFromUnified,
};

const AVATAR_SIZE_CLASS = {
  xs: "size-6",
  sm: "size-10",
  md: "size-12",
  lg: "size-14",
} as const;

const NAME_SIZE_CLASS = {
  xs: "text-[11px]",
  sm: "text-[12px]",
  md: "text-[13px]",
  lg: "text-sm",
} as const;

const HANDLE_SIZE_CLASS = {
  xs: "text-[10px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-[11px]",
} as const;

const BADGE_SIZE_CLASS: Record<CountryFlagBadgeOverlaySize, string> = {
  xs: "size-4",
  sm: "size-5",
  md: "size-5",
  lg: "size-6",
};

/** Country flag overlay — one step smaller than avatar for ~50% proportion (matches Discovery lg). */
const AVATAR_COUNTRY_BADGE_SIZE: Record<
  keyof typeof AVATAR_SIZE_CLASS,
  CountryFlagBadgeOverlaySize
> = {
  xs: "xs",
  sm: "xs",
  md: "sm",
  lg: "lg",
};

export type CreatorProfileLinkProps = {
  source: CreatorProfileSource;
  size?: keyof typeof AVATAR_SIZE_CLASS;
  layout?: "horizontal" | "stacked";
  showAvatar?: boolean;
  showName?: boolean;
  showHandle?: boolean;
  /** Overlay on avatar: platform icon (default) or country flag. */
  avatarBadge?: "platform" | "country" | "none";
  showPlatformBadge?: boolean;
  showExternalIcon?: boolean;
  /** When false, display name is plain text (e.g. row click opens detail sheet). Default true. */
  linkName?: boolean;
  /**
   * Internal route for the display name (e.g. `/vendors/{id}`). Takes precedence over the
   * external profile link on the name; the social profile stays reachable via the avatar /
   * external icon. Avoids nesting `<a>` inside `<a>` — never wrap this component in a Link.
   */
  nameHref?: string;
  /** Opens internal creator detail when name is not an external profile link. */
  onNameClick?: () => void;
  stopPropagation?: boolean;
  className?: string;
  nameClassName?: string;
  trailing?: ReactNode;
};

function formatHandle(handle: string | null | undefined): string | null {
  const trimmed = handle?.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : null;
}

function ProfileExternalLink({
  href,
  tooltip,
  stopPropagation,
  className,
  children,
}: {
  href: string;
  tooltip: string;
  stopPropagation?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={tooltip}
          className={className}
          onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        >
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Avatar + display name with optional badge overlay, external social profile links, and tooltips. */
export function CreatorProfileLink({
  source,
  size = "md",
  layout = "horizontal",
  showAvatar = true,
  showName = true,
  showHandle = true,
  avatarBadge,
  showPlatformBadge = true,
  showExternalIcon = false,
  linkName = true,
  nameHref,
  onNameClick,
  stopPropagation = false,
  className,
  nameClassName,
  trailing,
}: CreatorProfileLinkProps) {
  const profileUrl = resolveCreatorProfileUrl(source);
  const handleLabel = formatHandle(source.handle);
  const tooltip = profileLinkTooltip(source.displayName, source.platform);
  const badgeDim = BADGE_SIZE_CLASS[size];
  const badgeMode = avatarBadge ?? (showPlatformBadge ? "platform" : "none");
  const showCountryBadge =
    badgeMode === "country" && Boolean(source.countryCodes?.length || source.countryCode);

  const avatarNode = (
    <CreatorAvatarImage avatarUrl={source.avatarUrl} profileUrl={profileUrl} size={size} />
  );

  const avatarBlock = showAvatar ? (
    <div className="relative shrink-0">
      {profileUrl ? (
        <ProfileExternalLink
          href={profileUrl}
          tooltip={tooltip}
          stopPropagation={stopPropagation}
          className="block rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {avatarNode}
        </ProfileExternalLink>
      ) : (
        avatarNode
      )}
      {showCountryBadge ? (
        <span
          className={cn(
            "pointer-events-none absolute -right-1 -bottom-1",
            BADGE_SIZE_CLASS[AVATAR_COUNTRY_BADGE_SIZE[size]]
          )}
        >
          <CountryFlagsStack
            countryCodes={source.countryCodes ?? (source.countryCode ? [source.countryCode] : [])}
            size={AVATAR_COUNTRY_BADGE_SIZE[size]}
            overlay
            className="size-full"
          />
        </span>
      ) : badgeMode === "platform" && source.platform ? (
        <span className="pointer-events-none absolute -right-1 -bottom-1 rounded-full ring-2 ring-card">
          <PlatformIcon platform={source.platform} size="xs" className={cn(badgeDim, "rounded-full")} />
        </span>
      ) : null}
    </div>
  ) : null;

  const nameClasses = cn(
    "truncate font-semibold text-foreground",
    NAME_SIZE_CLASS[size],
    nameClassName,
    onNameClick &&
      "cursor-pointer text-left hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
  );

  const nameNode = showName ? (
    <div className="flex min-w-0 items-center gap-1.5">
      {nameHref ? (
        <Link
          href={nameHref}
          onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
          className={cn(
            "truncate font-semibold text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            NAME_SIZE_CLASS[size],
            nameClassName
          )}
        >
          {source.displayName}
        </Link>
      ) : profileUrl && linkName ? (
        <ProfileExternalLink
          href={profileUrl}
          tooltip={tooltip}
          stopPropagation={stopPropagation}
          className={cn(
            "truncate font-semibold text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            NAME_SIZE_CLASS[size],
            nameClassName
          )}
        >
          {source.displayName}
        </ProfileExternalLink>
      ) : onNameClick ? (
        <button
          type="button"
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
            onNameClick();
          }}
          className={nameClasses}
        >
          {source.displayName}
        </button>
      ) : (
        <span className={nameClasses}>{source.displayName}</span>
      )}
      {source.isVerified ? (
        <BadgeCheckIcon className="size-3.5 shrink-0 text-primary" aria-label="Verified" />
      ) : null}
      {(showExternalIcon || Boolean(nameHref)) && profileUrl ? (
        <ProfileExternalLink
          href={profileUrl}
          tooltip={openOnPlatformTooltip(source.platform)}
          stopPropagation={stopPropagation}
          className="shrink-0 text-muted-foreground/60 hover:text-primary"
        >
          <ExternalLinkIcon className="size-3" />
        </ProfileExternalLink>
      ) : null}
      {trailing}
    </div>
  ) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "min-w-0",
          layout === "horizontal" ? "flex items-center gap-3" : "flex flex-col gap-1",
          className
        )}
      >
        {avatarBlock}
        {(nameNode || (showHandle && handleLabel)) ? (
          <div className="min-w-0">
            {nameNode}
            {showHandle && handleLabel ? (
              <p className={cn("truncate text-muted-foreground", HANDLE_SIZE_CLASS[size])}>
                {handleLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

/** Compact table cell variant — avatar, name, optional handle. */
export function CreatorIdentityCell(props: CreatorProfileLinkProps) {
  return <CreatorProfileLink {...props} size={props.size ?? "sm"} showExternalIcon={false} />;
}

export { resolveCreatorProfileUrl, resolvePrimaryProfileUrl };
