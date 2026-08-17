"use client";

import { useState } from "react";

import { AVATAR_GRADS, initialsFromName } from "../presentation";

export function ReviewAvatar({
  url,
  name,
  index,
  className,
  initialsClassName,
  children,
}: {
  url?: string;
  name: string;
  index: number;
  className: string;
  initialsClassName?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;
  return (
    <div className={className} style={{ background: AVATAR_GRADS[index % AVATAR_GRADS.length] }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={initialsClassName}>{initialsFromName(name)}</span>
      )}
      {children}
    </div>
  );
}
