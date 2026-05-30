'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Megaphone,
  Building2,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  Target,
  GitBranch,
  Search,
  UserCog,
  ShieldCheck,
  Settings,
  ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { NavItem } from './nav-item'
import { PLATFORM_NAV, ADMIN_NAV, filterNavForRole } from '@/lib/constants/navigation'
import type { UserRole } from '@/types/auth'
import { PLATFORM } from '@/config/platform'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Megaphone,
  Building2,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  Target,
  GitBranch,
  Search,
  UserCog,
  ShieldCheck,
  Settings,
  ClipboardList,
}

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const filteredNav = filterNavForRole(PLATFORM_NAV, role)
  const filteredAdmin = role === 'admin' ? ADMIN_NAV : []

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="flex size-8 items-center justify-center rounded-xl bg-brand">
          <span className="text-sm font-bold text-white">TW</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground leading-tight">
            {PLATFORM.name}
          </span>
          <span className="text-[10px] text-sidebar-foreground/50 leading-tight">
            {PLATFORM.client}
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-0.5 px-3">
          {filteredNav.map((section) => (
            <div key={section.title ?? 'main'} className="mb-1">
              {section.title && (
                <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconName]
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === item.href
                    : pathname.startsWith(item.href)

                return (
                  <NavItem
                    key={item.href}
                    label={item.label}
                    href={item.href}
                    icon={Icon ? <Icon className="size-4" /> : null}
                    isActive={isActive}
                  />
                )
              })}
            </div>
          ))}

          {filteredAdmin.length > 0 && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              {filteredAdmin.map((section) => (
                <div key={section.title ?? 'admin'} className="mb-1">
                  {section.title && (
                    <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {section.title}
                    </p>
                  )}
                  {section.items.map((item) => {
                    const Icon = ICON_MAP[item.iconName]
                    const isActive = pathname.startsWith(item.href)

                    return (
                      <NavItem
                        key={item.href}
                        label={item.label}
                        href={item.href}
                        icon={Icon ? <Icon className="size-4" /> : null}
                        isActive={isActive}
                      />
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}
