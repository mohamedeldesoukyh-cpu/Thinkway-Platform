import { Skeleton } from '@/components/ui/skeleton'

export default function CampaignsLoading() {
  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-36 rounded-4xl" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 grid grid-cols-7 gap-4">
          {['Campaign', 'Client', 'Type', 'Status', 'Stage', 'Budget', ''].map((h, i) => (
            <Skeleton key={i} className="h-3.5 w-full max-w-[80px]" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 grid grid-cols-7 gap-4 border-t border-border">
            <div className="flex flex-col gap-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-4 w-28 self-center" />
            <Skeleton className="h-5 w-20 rounded-full self-center" />
            <Skeleton className="h-5 w-16 rounded-full self-center" />
            <Skeleton className="h-5 w-24 rounded-full self-center" />
            <Skeleton className="h-4 w-20 self-center" />
            <Skeleton className="size-7 rounded-xl self-center justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  )
}
