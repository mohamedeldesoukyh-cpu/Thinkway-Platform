"use client";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DiscoveryLoadingStateProps = {
  message?: string;
  className?: string;
};

/** Full-region loading — Thinkway logo while Search (and other Discovery surfaces) wait. */
export function DiscoveryLoadingState({
  message = "Loading",
  className,
}: DiscoveryLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center py-24",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <ThinkwayPageLoader label={message} />
    </div>
  );
}

type DiscoveryListSkeletonProps = {
  rows?: number;
  className?: string;
};

/** Table/list skeleton — for list pages before data loads. */
export function DiscoveryListSkeleton({ rows = 6, className }: DiscoveryListSkeletonProps) {
  return (
    <div className={cn("space-y-2 p-4", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
