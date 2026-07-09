import { Skeleton } from "@/components/ui/skeleton";

export default function AiLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#fafbff] dark:bg-background">
      <Skeleton className="h-14 shrink-0 rounded-none" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border p-2 lg:flex">
          <Skeleton className="h-[34px] w-full rounded-lg" />
          <Skeleton className="h-[30px] w-full rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6">
          <Skeleton className="size-16 rounded-[22px]" />
          <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
          <div className="mt-4 grid w-full max-w-[640px] grid-cols-1 gap-2.5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
