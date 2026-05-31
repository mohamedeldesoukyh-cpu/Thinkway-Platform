'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard] Render error:', error.message, error.stack)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
        <span className="text-xl">⚠</span>
      </div>
      <h2 className="text-base font-semibold text-foreground mb-2">Dashboard failed to load</h2>
      <p className="text-sm text-muted-foreground mb-1 max-w-xs">
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4 font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
