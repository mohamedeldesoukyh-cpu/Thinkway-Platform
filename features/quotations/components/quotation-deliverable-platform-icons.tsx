"use client";

import { Loader2Icon } from "lucide-react";

import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  platforms: string[];
  loading?: boolean;
  /** When true, show an "All Platforms" badge instead of platform logos. */
  allPlatforms?: boolean;
  className?: string;
};

/** Platform logos or an All Platforms badge for a deliverable pricing row. */
export function QuotationDeliverablePlatformIcons({
  platforms,
  loading,
  allPlatforms,
  className,
}: Props) {
  if (loading && platforms.length === 0 && !allPlatforms) {
    return (
      <Loader2Icon
        className="size-5 animate-spin text-muted-foreground"
        aria-label="Loading platforms"
      />
    );
  }

  if (allPlatforms) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "max-w-[4.5rem] whitespace-normal px-1.5 py-0.5 text-center text-[9px] leading-tight font-semibold uppercase",
          className
        )}
        aria-label="All Platforms"
      >
        All Platform
      </Badge>
    );
  }

  if (platforms.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <CreatorLinkedPlatformIcons platforms={platforms} variant="cell" className={className} />
  );
}
