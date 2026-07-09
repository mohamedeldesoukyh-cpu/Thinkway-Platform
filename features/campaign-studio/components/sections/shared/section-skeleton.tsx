"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SectionSkeletonProps = {
  variant?: "cards" | "chart" | "timeline" | "pipeline" | "vendors";
  className?: string;
};

export function SectionSkeleton({ variant = "cards", className }: SectionSkeletonProps) {
  if (variant === "pipeline") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-32" />
        <div className="flex h-28 items-end gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-lg"
              style={{ height: `${40 + i * 12}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "timeline") {
    return (
      <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (variant === "vendors") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
