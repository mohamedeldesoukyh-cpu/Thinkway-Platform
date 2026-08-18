"use client";

import { useState } from "react";

import { AVATAR_GRADS, initialsFromName } from "../presentation";
import { clientReviewAvatarUrl } from "../review-media";

export function ReviewAvatar({
  url,
  profileUrl,
  name,
  index,
  token,
  className,
  initialsClassName,
  children,
}: {
  url?: string;
  profileUrl?: string;
  name: string;
  index: number;
  token?: string;
  className: string;
  initialsClassName?: string;
  children?: React.ReactNode;
}) {
  const src = token ? clientReviewAvatarUrl(token, url, profileUrl) : url;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <div className={className} style={{ background: AVATAR_GRADS[index % AVATAR_GRADS.length] }}>
      {showImage ? (
        <RetryableReviewImage key={src} src={src!} onFailed={() => setFailedSrc(src!)} />
      ) : (
        <span className={initialsClassName}>{initialsFromName(name)}</span>
      )}
      {children}
    </div>
  );
}

export function RetryableReviewImage({ src, onFailed }: { src: string; onFailed?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) return null;
  const displaySrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt=""
      onError={() => {
        if (attempt >= 1) {
          setFailed(true);
          onFailed?.();
          return;
        }
        window.setTimeout(() => setAttempt(1), 1500);
      }}
    />
  );
}
