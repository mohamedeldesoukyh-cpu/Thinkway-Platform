import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/session'
import { ROLE_LABELS, ROLE_BADGE_COLORS, canViewDashboard } from '@/lib/permissions/roles'
import { ROUTES } from '@/lib/constants/routes'
import { PLATFORM } from '@/config/platform'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (!profile) redirect(ROUTES.AUTH.LOGIN)

  // Data Entry role has no dashboard access per §6.2
  if (!canViewDashboard(profile.role)) {
    redirect(ROUTES.CAMPAIGNS.ROOT)
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-1 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              ROLE_BADGE_COLORS[profile.role]
            )}
          >
            {ROLE_LABELS[profile.role]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome back, {profile.fullName.split(' ')[0]}
        </p>
      </div>

      {/* Phase 1B: KPI cards, revenue charts, and data will be built here */}
      <div className="rounded-4xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 mx-auto mb-4">
          <span className="text-xl font-bold text-brand">TW</span>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">
          {PLATFORM.name} is ready
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Authentication and shell are operational. Campaign, billing, and reporting modules build in the next phases.
        </p>
      </div>
    </div>
  )
}
