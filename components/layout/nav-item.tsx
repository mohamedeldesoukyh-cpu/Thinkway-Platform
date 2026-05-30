'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NavItemProps {
  label: string
  href: string
  icon: React.ReactNode
  isActive: boolean
  isCollapsed?: boolean
  badge?: number
}

export function NavItem({
  label,
  href,
  icon,
  isActive,
  isCollapsed = false,
  badge,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-brand/10 text-brand'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center transition-colors',
          isActive ? 'text-brand' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
        )}
      >
        {icon}
      </span>

      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
