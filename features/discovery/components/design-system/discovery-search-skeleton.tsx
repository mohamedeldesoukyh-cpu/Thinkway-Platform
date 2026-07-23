import { Skeleton } from "@/components/ui/skeleton";

/** Exact-row loading skeleton — matches Search result list layout. */
export function DiscoverySearchExactRowSkeleton() {
  return (
    <div className="discovery-search-exact-row">
      <div className="discovery-search-exact-photo-cell">
        <Skeleton className="size-[87px] rounded-full" />
      </div>
      <div className="discovery-search-exact-info-cell">
        <div className="discovery-search-exact-info-stack">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-[72px] w-[260px] rounded-xl" />
      <div className="discovery-search-exact-feed-thumbs">
        <Skeleton className="size-14 rounded-[10px]" />
        <Skeleton className="size-14 rounded-[10px]" />
        <Skeleton className="size-14 rounded-[10px]" />
      </div>
      <div className="discovery-search-exact-actions">
        <Skeleton className="h-[38px] w-[128px] rounded-[10px]" />
        <Skeleton className="size-[38px] rounded-[10px]" />
      </div>
    </div>
  );
}

type DiscoverySearchExactListSkeletonProps = {
  rows?: number;
};

export function DiscoverySearchExactListSkeleton({
  rows = 6,
}: DiscoverySearchExactListSkeletonProps) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, index) => (
        <DiscoverySearchExactRowSkeleton key={index} />
      ))}
    </div>
  );
}
