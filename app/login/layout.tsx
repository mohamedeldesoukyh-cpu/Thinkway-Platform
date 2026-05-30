import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 p-4">
      {children}
    </div>
  )
}
