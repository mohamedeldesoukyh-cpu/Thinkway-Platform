import { cn } from '@/lib/utils'
import type { CampaignStatusDb, CampaignTypeDb, CiStatusDb, DeliverableStatusDb } from '@/types/database'
import { CAMPAIGN_LIFECYCLE_STAGES } from '@/lib/constants/app'

const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatusDb, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  planning:  { label: 'Planning',  className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  active:    { label: 'Active',    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  paused:    { label: 'Paused',    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  completed: { label: 'Completed', className: 'bg-brand/10 text-brand' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
}

const CAMPAIGN_TYPE_CONFIG: Record<CampaignTypeDb, { label: string; className: string }> = {
  fixed:       { label: 'Fixed',       className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  hard_roi:    { label: 'Hard ROI',    className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  performance: { label: 'Performance', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
}

const CI_STATUS_CONFIG: Record<CiStatusDb, { label: string; className: string }> = {
  invited:   { label: 'Invited',   className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  confirmed: { label: 'Confirmed', className: 'bg-brand/10 text-brand' },
  active:    { label: 'Active',    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  completed: { label: 'Completed', className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  declined:  { label: 'Declined',  className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  removed:   { label: 'Removed',   className: 'bg-red-500/10 text-red-700 dark:text-red-400 opacity-60' },
}

const DELIVERABLE_STATUS_CONFIG: Record<DeliverableStatusDb, { label: string; className: string }> = {
  not_started:        { label: 'Not started',        className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  in_progress:        { label: 'In progress',        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  submitted:          { label: 'Submitted',          className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' },
  in_review:          { label: 'In review',          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  revision_requested: { label: 'Revision requested', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  approved:           { label: 'Approved',           className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  scheduled:          { label: 'Scheduled',          className: 'bg-brand/10 text-brand' },
  published:          { label: 'Published',          className: 'bg-brand/20 text-brand font-semibold' },
  live:               { label: 'Live',               className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold' },
  rejected:           { label: 'Rejected',           className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  cancelled:          { label: 'Cancelled',          className: 'bg-zinc-500/10 text-zinc-500 opacity-60' },
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export function CampaignStatusBadge({ status }: { status: CampaignStatusDb }) {
  const cfg = CAMPAIGN_STATUS_CONFIG[status] ?? CAMPAIGN_STATUS_CONFIG.draft
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

export function CampaignTypeBadge({ type }: { type: CampaignTypeDb }) {
  const cfg = CAMPAIGN_TYPE_CONFIG[type] ?? CAMPAIGN_TYPE_CONFIG.fixed
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

export function CiStatusBadge({ status }: { status: CiStatusDb }) {
  const cfg = CI_STATUS_CONFIG[status] ?? CI_STATUS_CONFIG.invited
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

export function DeliverableStatusBadge({ status }: { status: DeliverableStatusDb }) {
  const cfg = DELIVERABLE_STATUS_CONFIG[status] ?? DELIVERABLE_STATUS_CONFIG.not_started
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

export function LifecycleStageBadge({ stage }: { stage: number }) {
  const info = CAMPAIGN_LIFECYCLE_STAGES.find((s) => s.step === stage)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
      <span className="font-bold">{stage}</span>
      <span className="opacity-80">{info?.label ?? `Stage ${stage}`}</span>
    </span>
  )
}
