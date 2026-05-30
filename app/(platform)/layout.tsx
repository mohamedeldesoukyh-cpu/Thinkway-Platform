import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getCurrentProfile } from '@/lib/auth/session'
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
    redirect(ROUTES.AUTH.LOGIN)
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
