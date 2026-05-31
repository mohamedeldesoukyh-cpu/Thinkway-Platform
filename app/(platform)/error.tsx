'use client'

import { useEffect } from 'react'

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Platform] Render error:', error.message, error.stack)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center p-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
        <span className="text-2xl">⚠</span>
      </div>
      <h2 className="text-base font-semibold text-foreground mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        {error.message || 'A rendering error occurred. Check the browser console for details.'}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground mb-4">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
