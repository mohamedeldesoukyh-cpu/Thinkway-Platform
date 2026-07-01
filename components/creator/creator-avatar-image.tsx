"use client";



import { UserIcon } from "lucide-react";

import { useEffect, useState } from "react";



import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";

import { cn } from "@/lib/utils";



const AVATAR_SIZE_CLASS = {

  xs: "size-6",

  sm: "size-8",

  md: "size-10",

  lg: "size-12",

} as const;



const AVATAR_CONTAINER_CLASS =

  "relative shrink-0 overflow-hidden rounded-full border border-border";



export type CreatorAvatarImageSize = keyof typeof AVATAR_SIZE_CLASS;



export function CreatorAvatarImage({

  avatarUrl,

  profileUrl,

  size = "md",

  sizeClassName,

  className,

  alt = "",

  onFailed,

}: {

  avatarUrl: string | null | undefined;

  /** External social profile URL — enables server OpenGraph fallback when CDN src fails. */

  profileUrl?: string | null;

  size?: CreatorAvatarImageSize;

  sizeClassName?: string;

  className?: string;

  alt?: string;

  onFailed?: () => void;

}) {

  const dim = sizeClassName ?? AVATAR_SIZE_CLASS[size];

  const src = creatorAvatarBrowserDisplayUrl(avatarUrl, profileUrl);

  const [failed, setFailed] = useState(false);



  useEffect(() => {

    setFailed(false);

  }, [src]);



  if (!src || failed) {

    return (

      <div

        className={cn(

          AVATAR_CONTAINER_CLASS,

          "flex items-center justify-center bg-muted",

          dim,

          className

        )}

      >

        <UserIcon className={cn(size === "xs" ? "size-3" : "size-5", "text-muted-foreground")} />

      </div>

    );

  }



  return (

    <div className={cn(AVATAR_CONTAINER_CLASS, dim, className)}>

      {/* eslint-disable-next-line @next/next/no-img-element */}

      <img

        key={src}

        src={src}

        alt={alt}

        referrerPolicy="no-referrer"

        className="size-full object-cover object-center"

        onError={() => {

          setFailed(true);

          onFailed?.();

        }}

      />

    </div>

  );

}

