'use client'

import { useTransition } from 'react'
import { LogOut, Settings, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import { ROLE_LABELS, ROLE_BADGE_COLORS } from '@/lib/permissions/roles'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/auth'

interface UserMenuProps {
  fullName: string
  email: string
  role: UserRole
  avatarUrl?: string | null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function UserMenu({ fullName, email, role, avatarUrl }: UserMenuProps) {
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-full">
          <Avatar className="size-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback className="bg-brand/10 text-brand text-xs">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
          <span className="font-semibold text-sm text-foreground">{fullName}</span>
          <span className="text-xs text-muted-foreground truncate">{email}</span>
          <span
            className={cn(
              'mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold',
              ROLE_BADGE_COLORS[role]
            )}
          >
            {ROLE_LABELS[role]}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/admin/settings" className="flex items-center gap-2">
            <User className="size-4" />
            Profile
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="/admin/settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            Settings
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isPending}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          {isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
