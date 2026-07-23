import { Skeleton } from "@/components/ui/skeleton";

/** Matches quotation-editor-rd4 layout while server data loads. */
export function QuotationWorkspaceLoadingSkeleton() {
  return (
    <div className="quotation-editor-rd4 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-8 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      <div className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b border-[var(--line)] px-8 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="sec compact px-8 py-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-[38px] w-full rounded-[10px]" />
              </div>
            ))}
          </div>
        </div>

        <div className="sec flush px-8 pb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="ctools mb-3 flex gap-2">
            <Skeleton className="h-9 w-[300px] rounded-[10px]" />
            <Skeleton className="h-9 w-[140px] rounded-[10px]" />
            <Skeleton className="h-9 w-[160px] rounded-[10px]" />
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            <Skeleton className="h-10 w-full rounded-none" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mx-4 my-2 h-16 w-[calc(100%-2rem)] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
