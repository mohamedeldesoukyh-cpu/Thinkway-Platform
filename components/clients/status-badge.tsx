import { cn } from '@/lib/utils'
import type { ClientStatusDb, ClientTierDb } from '@/types/database'

const STATUS_CONFIG: Record<ClientStatusDb, { label: string; className: string }> = {
  active:   { label: 'Active',    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  inactive: { label: 'Inactive',  className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  prospect: { label: 'Prospect',  className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  churned:  { label: 'Churned',   className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  on_hold:  { label: 'On Hold',   className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
}

const TIER_CONFIG: Record<ClientTierDb, { label: string; className: string }> = {
  standard:   { label: 'Standard',   className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  premium:    { label: 'Premium',    className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  enterprise: { label: 'Enterprise', className: 'bg-brand/10 text-brand' },
  strategic:  { label: 'Strategic',  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
}

export function StatusBadge({ status }: { status: ClientStatusDb }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      config.className
    )}>
      {config.label}
    </span>
  )
}

export function TierBadge({ tier }: { tier: ClientTierDb }) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.standard
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      config.className
    )}>
      {config.label}
    </span>
  )
}
