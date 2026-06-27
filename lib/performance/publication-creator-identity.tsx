"use client";

import { useState, type ReactNode } from "react";

import {
  CreatorAvatarImage,
} from "@/components/creator/creator-avatar-image";
import {
  CreatorProfileLink,
  type CreatorProfileSource,
} from "@/components/creator/creator-profile-link";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import {
  initialsFromCreatorName,
  resolveCreatorAvatarDisplay,
  resolvePublicationRowCreatorAvatar,
  type CreatorAvatarDisplay,
} from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

export type PublicationCreatorIdentityRow = Pick<
  CampaignPublicationRow,
  | "platform"
  | "publication_type"
  | "content_url"
  | "creator_profile_image_url"
  | "influencer_avatar_url"
  | "social_profile_picture_url"
  | "influencer_name"
  | "influencer_handle"
  | "influencer_profile_url"
  | "apify_author_avatar_url"
>;

const AVATAR_SIZE_CLASS = {
  xs: "size-6 text-[9px]",
  sm: "size-7 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-9 text-[12px]",
} as const;

type AvatarSize = keyof typeof AVATAR_SIZE_CLASS;

export type CreatorAvatarRenderInput = PublicationCreatorIdentityRow;

/** Resolve creator avatar URL only (no initials / platform icon). */
export function resolvePublicationCreatorAvatarUrl(row: CreatorAvatarRenderInput): string | null {
  return resolvePublicationRowCreatorAvatar(row);
}

export function resolvePublicationCreatorAvatarDisplay(
  row: CreatorAvatarRenderInput
): CreatorAvatarDisplay {
  return resolveCreatorAvatarDisplay({
    ...row,
    social_profile_picture_url: row.social_profile_picture_url,
  });
}

export function publicationCreatorProfileSource(
  row: CreatorAvatarRenderInput,
  name?: string | null
): CreatorProfileSource {
  return {
    displayName: name ?? row.influencer_name ?? "—",
    avatarUrl: resolvePublicationCreatorAvatarUrl(row),
    platform: row.platform,
    handle: row.influencer_handle,
    profile_url: row.influencer_profile_url,
  };
}

function InitialsAvatar({
  name,
  size,
  className,
}: {
  name: string;
  size: AvatarSize;
  className?: string;
}) {
  const dim = AVATAR_SIZE_CLASS[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground",
        dim,
        className
      )}
      aria-hidden
    >
      {initialsFromCreatorName(name)}
    </span>
  );
}

export function PublicationCreatorAvatar({
  row,
  size = "sm",
  className,
}: {
  row: CreatorAvatarRenderInput;
  size?: AvatarSize;
  className?: string;
}) {
  const display = resolvePublicationCreatorAvatarDisplay(row);
  const dim = AVATAR_SIZE_CLASS[size];
  const [imageFailed, setImageFailed] = useState(false);

  if (display.kind === "image" && !imageFailed) {
    return (
      <CreatorAvatarImage
        avatarUrl={display.url}
        platform={row.platform}
        fallbackUrl={display.fallbackUrl}
        sizeClassName={cn("shrink-0", dim, className)}
        onFailed={() => setImageFailed(true)}
      />
    );
  }

  const fallbackName = row.influencer_name?.trim();
  if (display.kind === "initials" || (display.kind === "image" && imageFailed && fallbackName)) {
    return (
      <InitialsAvatar
        name={display.kind === "initials" ? display.name : fallbackName!}
        size={size}
        className={className}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground/60",
        dim,
        className
      )}
      aria-hidden
    >
      ?
    </span>
  );
}

export function PublicationCreatorName({
  row,
  name,
  className,
  avatarSize = "sm",
  children,
  stopPropagation = false,
}: {
  row: CreatorAvatarRenderInput;
  name?: string | null;
  className?: string;
  avatarSize?: AvatarSize;
  children?: ReactNode;
  stopPropagation?: boolean;
}) {
  const displayName =
    typeof children === "string"
      ? children
      : name ?? row.influencer_name ?? "—";

  return (
    <CreatorProfileLink
      source={publicationCreatorProfileSource(row, displayName)}
      size={avatarSize === "xs" ? "xs" : avatarSize === "lg" ? "md" : "sm"}
      showHandle={false}
      stopPropagation={stopPropagation}
      className={className}
      nameClassName="font-medium"
    />
  );
}

export { resolvePublicationRowCreatorAvatar };
