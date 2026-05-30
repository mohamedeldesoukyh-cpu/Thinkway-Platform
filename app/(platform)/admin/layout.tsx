import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/session'
import { ROUTES } from '@/lib/constants/routes'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    redirect(ROUTES.DASHBOARD)
  }

  return <>{children}</>
}
