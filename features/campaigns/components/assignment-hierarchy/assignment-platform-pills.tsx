"use client";

import { PLATFORM_SHORT_LABELS, isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

type AssignmentPlatformPillsProps = {
  platforms: readonly string[];
  className?: string;
};

function platformPillClass(platform: string): string {
  if (platform === "instagram") return "thinkway-campaign-plat-mini-ig";
  if (platform === "tiktok") return "thinkway-campaign-plat-mini-tt";
  return "thinkway-campaign-plat-mini-other";
}

function platformLabel(platform: string): string {
  if (isSocialPlatform(platform)) {
    return PLATFORM_SHORT_LABELS[platform as SocialPlatform];
  }
  return platform.slice(0, 2).toUpperCase();
}

/** Platform mini-pills — matches thinkway-campaign_2.html `.plat-mini`. */
export function AssignmentPlatformPills({ platforms, className }: AssignmentPlatformPillsProps) {
  if (platforms.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {platforms.map((platform) => (
        <span
          key={platform}
          className={cn("thinkway-campaign-plat-mini", platformPillClass(platform))}
        >
          {platformLabel(platform)}
        </span>
      ))}
    </div>
  );
}
