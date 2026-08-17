"use client";

import { useState } from "react";

import { AVATAR_GRADS, initialsFromName } from "../presentation";
import { clientReviewAvatarUrl } from "../review-media";

export function ReviewAvatar({
  url,
  name,
  index,
  token,
  className,
  initialsClassName,
  children,
}: {
  url?: string;
  name: string;
  index: number;
  token?: string;
  className: string;
  initialsClassName?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const src = token ? clientReviewAvatarUrl(token, url) : url;
  const showImage = Boolean(src) && !failed;
  return (
    <div className={className} style={{ background: AVATAR_GRADS[index % AVATAR_GRADS.length] }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={initialsClassName}>{initialsFromName(name)}</span>
      )}
      {children}
    </div>
  );
}
