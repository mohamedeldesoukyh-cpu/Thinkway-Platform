import { cn } from "@/lib/utils";

export type PlatformIconStyle = {
  label: string;
  className: string;
  title: string;
  imageUrl?: string;
};

export const PLATFORM_ICON_STYLES: Record<string, PlatformIconStyle> = {
  instagram: {
    label: "IG",
    title: "Instagram",
    className: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
    imageUrl: "/platform-icons/instagram.png",
  },
  tiktok: {
    label: "TT",
    title: "TikTok",
    className: "bg-[#010101] text-white",
    imageUrl: "/platform-icons/tiktok.png",
  },
  youtube: {
    label: "YT",
    title: "YouTube",
    className: "bg-[#FF0000] text-white",
    imageUrl: "/platform-icons/youtube.svg",
  },
  snapchat: {
    label: "SC",
    title: "Snapchat",
    className: "bg-[#FFFC00] text-[#111111]",
  },
  facebook: {
    label: "FB",
    title: "Facebook",
    className: "bg-[#1877F2] text-white",
    imageUrl: "/platform-icons/facebook.svg",
  },
  twitter: {
    label: "X",
    title: "X (Twitter)",
    className: "bg-foreground text-background",
  },
  linkedin: {
    label: "IN",
    title: "LinkedIn",
    className: "bg-[#0A66C2] text-white",
  },
};

function normalizePlatformKey(platform: string | null | undefined): string {
  const value = (platform ?? "").trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  if (value === "yt") return "youtube";
  if (value === "fb") return "facebook";
  if (value === "sc") return "snapchat";
  return value;
}

type PlatformIconProps = {
  platform: string;
  size?: "xs" | "sm" | "md";
  /** `logo` = circular brand mark only (no border / ring). */
  variant?: "default" | "logo";
  className?: string;
};

const PLATFORM_ICON_DIMENSION = {
  xs: "size-7",
  sm: "size-9",
  md: "size-10",
} as const;

const LOGO_ICON_CLASS = "rounded-full object-cover border-0 ring-0 shadow-none";

export function PlatformIcon({
  platform,
  size = "sm",
  variant = "default",
  className,
}: PlatformIconProps) {
  const key = normalizePlatformKey(platform);
  const badge = PLATFORM_ICON_STYLES[key] ?? {
    label: key.slice(0, 2).toUpperCase() || "?",
    title: platform,
    className: "bg-muted text-muted-foreground",
  };

  const dimension = PLATFORM_ICON_DIMENSION[size];

  if (badge.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={badge.imageUrl}
        alt=""
        title={badge.title}
        aria-label={badge.title}
        className={cn(
          "shrink-0 object-contain",
          dimension,
          variant === "logo" && LOGO_ICON_CLASS,
          className
        )}
      />
    );
  }

  const textSize = size === "md" ? "text-[11px]" : "text-[10px]";

  return (
    <span
      title={badge.title}
      aria-label={badge.title}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border font-bold uppercase",
        dimension,
        textSize,
        badge.className,
        className
      )}
    >
      {badge.label}
    </span>
  );
}
