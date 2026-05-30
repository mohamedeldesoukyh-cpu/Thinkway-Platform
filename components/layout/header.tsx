import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'
import type { UserRole } from '@/types/auth'

interface HeaderProps {
  fullName: string
  email: string
  role: UserRole
  avatarUrl?: string | null
  pageTitle?: string
}

export function Header({ fullName, email, role, avatarUrl, pageTitle }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
      {/* Mobile nav trigger */}
      <MobileNav role={role} />

      {/* Page title slot */}
      {pageTitle && (
        <>
          <Separator orientation="vertical" className="h-5 hidden md:block" />
          <span className="hidden text-sm font-medium text-foreground md:block">
            {pageTitle}
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notification bell — wired up in Phase 2 */}
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled>
          <Bell className="size-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        <UserMenu
          fullName={fullName}
          email={email}
          role={role}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  )
}
