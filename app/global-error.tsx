'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global] Application error:', error.message, error.stack)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '3rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠</div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111' }}>
            Application error
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', maxWidth: '24rem' }}>
            {error.message || 'A critical error occurred. Check the browser console for details.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af', marginBottom: '1rem' }}>
              ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              background: 'oklch(0.618 0.141 162)',
              color: '#fff',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </body>
    </html>
  )
}
