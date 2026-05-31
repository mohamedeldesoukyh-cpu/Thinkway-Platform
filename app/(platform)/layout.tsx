import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getCurrentProfile, getCurrentUser } from '@/lib/auth/session'
import { signOut } from '@/lib/auth/actions'
import { ROUTES } from '@/lib/constants/routes'
import { PLATFORM } from '@/config/platform'

export const metadata: Metadata = {
  title: {
    default: PLATFORM.name,
    template: `%s — ${PLATFORM.name}`,
  },
  description: `${PLATFORM.name} ${PLATFORM.tagline}`,
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile) {
    // getCurrentProfile() auto-creates a profile row if one is missing.
    // Reaching here means the user is genuinely unauthenticated OR the
    // INSERT failed (e.g. RLS policy gap after a schema migration).
    //
    // Check auth state to avoid the redirect loop:
    //   layout → redirect /login → proxy → redirect /dashboard → layout → ...
    const user = await getCurrentUser()

    if (!user) {
      // Not authenticated — normal redirect to login.
      redirect(ROUTES.AUTH.LOGIN)
    }

    // Authenticated but profile could not be created.
    // Show a recovery screen so the user can sign out cleanly instead of
    // hitting an infinite redirect loop.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
            <span className="text-xl font-bold text-destructive">!</span>
          </div>
          <h1 className="text-base font-semibold text-foreground mb-2">
            Profile not found
          </h1>
          <p className="text-sm text-muted-foreground mb-1 max-w-xs mx-auto">
            Your session is valid but no user profile could be created.
            This usually means the RLS policies haven&apos;t been applied yet.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Run <strong>policies.sql</strong> in the Supabase SQL Editor,
            then sign in again.
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
            >
              Sign out
            </button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground font-mono">{user.email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <Sidebar role={profile.role} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          fullName={profile.fullName}
          email={profile.email}
          role={profile.role}
          avatarUrl={profile.avatarUrl}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
