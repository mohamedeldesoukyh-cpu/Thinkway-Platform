'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Campaigns] Error:', error)
  }, [error])

  return (
    <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
        <span className="text-xl font-bold text-destructive">!</span>
      </div>
      <div className="text-center">
        <h2 className="text-base font-semibold text-foreground mb-1">Failed to load campaigns</h2>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </div>
  )
}
