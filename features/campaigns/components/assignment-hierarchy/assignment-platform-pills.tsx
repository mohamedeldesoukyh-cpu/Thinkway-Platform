"use client";

import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { cn } from "@/lib/utils";

type AssignmentPlatformPillsProps = {
  platforms: readonly string[];
  className?: string;
};

/** Overlapping platform avatars for the Assignments parent Platforms column. */
export function AssignmentPlatformPills({ platforms, className }: AssignmentPlatformPillsProps) {
  if (platforms.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <CreatorLinkedPlatformIcons
      platforms={[...platforms]}
      variant="inline"
      className={cn("justify-start", className)}
    />
  );
}
