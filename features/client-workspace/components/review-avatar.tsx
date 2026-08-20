"use client";

import { useEffect, useRef, useState } from "react";

import { useMediaProxyImageRecovery } from "@/hooks/use-media-proxy-image-recovery";

import { avatarProfileUrlForReview } from "../platform-breakdown";
import { AVATAR_GRADS, initialsFromName } from "../presentation";
import { clientReviewAvatarUrl } from "../review-media";

export function ReviewAvatar({
  url,
  profileUrl,
  handle,
  platform,
  platformAccounts,
  name,
  index,
  token,
  className,
  initialsClassName,
  children,
}: {
  url?: string;
  profileUrl?: string;
  handle?: string;
  platform?: string;
  platformAccounts?: Array<{ platform: string; handle?: string; profileUrl?: string }>;
  name: string;
  index: number;
  token?: string;
  className: string;
  initialsClassName?: string;
  children?: React.ReactNode;
}) {
  const fetchProfileUrl =
    avatarProfileUrlForReview({
      profileUrl,
      handle,
      platform,
      platformAccounts,
    }) ?? profileUrl;
  const src = token ? clientReviewAvatarUrl(token, url, fetchProfileUrl) : url;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <div className={className} style={{ background: AVATAR_GRADS[index % AVATAR_GRADS.length] }}>
      {showImage ? (
        <RetryableReviewImage
          key={src}
          className="rw-avatar-img"
          src={src!}
          onFailed={() => setFailedSrc(src!)}
        />
      ) : (
        <span className={initialsClassName ?? "ini"}>{initialsFromName(name)}</span>
      )}
      {children}
    </div>
  );
}

export function RetryableReviewImage({
  src,
  onFailed,
  className,
}: {
  src: string;
  onFailed?: () => void;
  className?: string;
}) {
  const recovery = useMediaProxyImageRecovery(src);
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
  }, [src]);

  useEffect(() => {
    if (recovery.exhausted && !notified.current) {
      notified.current = true;
      onFailed?.();
    }
  }, [recovery.exhausted, onFailed]);

  if (recovery.exhausted) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={recovery.displaySrc ?? src}
      alt=""
      onError={recovery.onError}
    />
  );
}
