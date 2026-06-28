"use client";

import { BadgeCheckIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  openOnPlatformTooltip,
  pickPrimaryPlatformAccount,
  profileLinkTooltip,
  resolveCreatorProfileUrl,
  resolvePrimaryProfileUrl,
  type ProfileUrlSource,
} from "@/lib/discovery/profile-url";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

export type CreatorProfileSource = {
  displayName: string;
  avatarUrl?: string | null;
  platform?: string | null;
  handle?: string | null;
  profile_url?: string | null;
  isVerified?: boolean;
};

const AVATAR_SIZE_CLASS = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
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

const BADGE_SIZE_CLASS = {
  xs: "size-4",
  sm: "size-5",
  md: "size-5",
  lg: "size-6",
} as const;

export type CreatorProfileLinkProps = {
  source: CreatorProfileSource;
  size?: keyof typeof AVATAR_SIZE_CLASS;
  layout?: "horizontal" | "stacked";
  showAvatar?: boolean;
  showName?: boolean;
  showHandle?: boolean;
  showPlatformBadge?: boolean;
  showExternalIcon?: boolean;
  /** When false, display name is plain text (e.g. row click opens detail sheet). Default true. */
  linkName?: boolean;
  stopPropagation?: boolean;
  className?: string;
  nameClassName?: string;
  trailing?: ReactNode;
};

export function creatorProfileSourceFromUnified(creator: UnifiedCreatorResult): CreatorProfileSource {
  const primary = creator.platforms[0];
  return {
    displayName: creator.display_name,
    avatarUrl: creator.profile_image_url,
    platform: primary?.platform,
    handle: primary?.handle,
    profile_url: primary?.profile_url,
    isVerified: creator.is_platform_verified,
  };
}

export function creatorProfileSourceFromPlatformAccount(
  displayName: string,
  account: {
    platform: string;
    handle: string;
    profile_url?: string | null;
    profile_picture_url?: string | null;
  } | null | undefined,
  options?: { avatarUrl?: string | null; isVerified?: boolean }
): CreatorProfileSource {
  return {
    displayName,
    avatarUrl: options?.avatarUrl ?? account?.profile_picture_url ?? null,
    platform: account?.platform,
    handle: account?.handle,
    profile_url: account?.profile_url,
    isVerified: options?.isVerified,
  };
}

export function creatorProfileSourceFromAccounts(
  displayName: string,
  accounts: Array<
    {
      platform: string;
      handle: string;
      profile_url?: string | null;
      profile_picture_url?: string | null;
      is_primary?: boolean | null;
    }
  > | null | undefined,
  options?: { avatarUrl?: string | null; isVerified?: boolean }
): CreatorProfileSource {
  const primary = pickPrimaryPlatformAccount(accounts ?? []);
  return creatorProfileSourceFromPlatformAccount(displayName, primary, options);
}

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

/** Avatar + display name with platform badge, external social profile links, and tooltips. */
export function CreatorProfileLink({
  source,
  size = "md",
  layout = "horizontal",
  showAvatar = true,
  showName = true,
  showHandle = true,
  showPlatformBadge = true,
  showExternalIcon = false,
  linkName = true,
  stopPropagation = false,
  className,
  nameClassName,
  trailing,
}: CreatorProfileLinkProps) {
  const profileUrl = resolveCreatorProfileUrl(source as ProfileUrlSource);
  const handleLabel = formatHandle(source.handle);
  const tooltip = profileLinkTooltip(source.displayName, source.platform);
  const avatarDim = AVATAR_SIZE_CLASS[size];
  const badgeDim = BADGE_SIZE_CLASS[size];

  const avatarNode = (
    <CreatorAvatarImage avatarUrl={source.avatarUrl} platform={source.platform} size={size} />
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
      {showPlatformBadge && source.platform ? (
        <span className="pointer-events-none absolute -right-1 -bottom-1 rounded-full ring-2 ring-card">
          <PlatformIcon platform={source.platform} size="xs" className={cn(badgeDim, "rounded-full")} />
        </span>
      ) : null}
    </div>
  ) : null;

  const nameNode = showName ? (
    <div className="flex min-w-0 items-center gap-1.5">
      {profileUrl && linkName ? (
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
      ) : (
        <span
          className={cn(
            "truncate font-semibold text-foreground",
            NAME_SIZE_CLASS[size],
            nameClassName
          )}
        >
          {source.displayName}
        </span>
      )}
      {source.isVerified ? (
        <BadgeCheckIcon className="size-3.5 shrink-0 text-primary" aria-label="Verified" />
      ) : null}
      {showExternalIcon && profileUrl ? (
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
