import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading chart">
      <Skeleton className="h-[160px] w-full rounded-2xl" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
