'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { NavItem } from './nav-item'
import { Separator } from '@/components/ui/separator'
import { PLATFORM_NAV, ADMIN_NAV, filterNavForRole } from '@/lib/constants/navigation'
import { PLATFORM } from '@/config/platform'
import type { UserRole } from '@/types/auth'

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

interface MobileNavProps {
  role: UserRole
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const filteredNav = filterNavForRole(PLATFORM_NAV, role)
  const filteredAdmin = role === 'admin' ? ADMIN_NAV : []

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
        <span className="sr-only">Open navigation</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetHeader className="flex h-16 flex-row items-center gap-3 border-b border-border px-5 space-y-0">
            <div className="flex size-8 items-center justify-center rounded-xl bg-brand">
              <span className="text-sm font-bold text-white">TW</span>
            </div>
            <SheetTitle className="text-sm font-semibold">{PLATFORM.name}</SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-0.5 p-3">
            {filteredNav.map((section) => (
              <div key={section.title ?? 'main'} className="mb-1">
                {section.title && (
                  <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
                    <span key={item.href} onClick={() => setOpen(false)}>
                      <NavItem
                        label={item.label}
                        href={item.href}
                        icon={Icon ? <Icon className="size-4" /> : null}
                        isActive={isActive}
                      />
                    </span>
                  )
                })}
              </div>
            ))}

            {filteredAdmin.length > 0 && (
              <>
                <Separator className="my-2" />
                {filteredAdmin.map((section) =>
                  section.items.map((item) => {
                    const Icon = ICON_MAP[item.iconName]
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <span key={item.href} onClick={() => setOpen(false)}>
                        <NavItem
                          label={item.label}
                          href={item.href}
                          icon={Icon ? <Icon className="size-4" /> : null}
                          isActive={isActive}
                        />
                      </span>
                    )
                  })
                )}
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
