"use client";

import { Loader2Icon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DiscoveryLoadingStateProps = {
  message?: string;
  className?: string;
};

/** Full-region loading indicator — Search-aligned typography. */
export function DiscoveryLoadingState({
  message = "Loading…",
  className,
}: DiscoveryLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-[var(--text-3)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-6 animate-spin text-[#0057ff]" aria-hidden />
      <span>{message}</span>
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
