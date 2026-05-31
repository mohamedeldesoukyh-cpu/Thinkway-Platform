export default function DashboardLoading() {
  return (
    <div className="p-6 lg:p-8 animate-pulse">
      <div className="flex flex-col gap-1 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-7 w-28 rounded-lg bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
        <div className="h-4 w-36 rounded bg-muted mt-1" />
      </div>

      <div className="rounded-4xl border border-dashed border-border bg-muted/30 p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 rounded-2xl bg-muted" />
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
