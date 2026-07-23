import { Skeleton } from "@/components/ui/skeleton";

export function GenericTableLoading() {
  return (
    <div className="space-y-4 rounded-[10px] border border-border bg-card p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
