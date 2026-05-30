import { Skeleton } from '@/components/ui/skeleton'

export function LoadingScreen() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex h-16 items-center gap-3 px-5">
          <Skeleton className="size-8 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-14" />
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Main area skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-4xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
