import { Skeleton } from '@/components/ui/skeleton'

export default function CampaignDetailLoading() {
  return (
    <div className="p-6 lg:p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-80" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-2xl border border-border p-5">
            <Skeleton className="h-5 w-20 mb-4" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-5">
            <Skeleton className="h-5 w-24 mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-2xl border border-border p-5">
          <Skeleton className="h-5 w-24 mb-4" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full mb-2 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
