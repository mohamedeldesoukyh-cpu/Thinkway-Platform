import { Skeleton } from '@/components/ui/skeleton'
import { ClientsTableSkeleton } from '@/components/clients/clients-table'

export default function ClientsLoading() {
  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-28 rounded-4xl" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-8 w-44 rounded-xl" />
      </div>

      <ClientsTableSkeleton />
    </div>
  )
}
