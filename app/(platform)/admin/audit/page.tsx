import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin — Audit' }

export default function AdminAuditPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-8">Audit</h1>
      <div className="rounded-4xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">Admin audit — Phase 1A</p>
      </div>
    </div>
  )
}
