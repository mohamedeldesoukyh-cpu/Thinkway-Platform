import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reports',
}

export default function ReportsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
      </div>
      <div className="rounded-4xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Reports module — Phase 1B
        </p>
      </div>
    </div>
  )
}
