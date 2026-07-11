"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SectionSkeletonProps = {
  variant?: "cards" | "chart" | "timeline" | "pipeline" | "vendors";
  className?: string;
};

function SkeletonShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse motion-reduce:animate-none", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading section content…</span>
      {children}
    </div>
  );
}

export function SectionSkeleton({ variant = "cards", className }: SectionSkeletonProps) {
  if (variant === "pipeline") {
    return (
      <SkeletonShell className={className}>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </SkeletonShell>
    );
  }

  if (variant === "chart") {
    return (
      <SkeletonShell className={cn("space-y-3", className)}>
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
      </SkeletonShell>
    );
  }

  if (variant === "timeline") {
    return (
      <SkeletonShell className={className}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </SkeletonShell>
    );
  }

  if (variant === "vendors") {
    return (
      <SkeletonShell className={cn("space-y-2", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </SkeletonShell>
    );
  }

  return (
    <SkeletonShell className={className}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </SkeletonShell>
  );
}
