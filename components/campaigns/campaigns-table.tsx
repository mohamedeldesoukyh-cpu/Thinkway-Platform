'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCampaign } from '@/app/actions/campaigns'
import type { Campaign } from '@/lib/repositories/campaigns'
import { CampaignStatusBadge, CampaignTypeBadge, LifecycleStageBadge } from './campaign-status-badge'
import { CampaignRowActions } from './campaign-row-actions'
import { CampaignEditSheet } from './campaign-edit-sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/lib/constants/routes'

interface Props {
  campaigns:  Campaign[]
  total:      number
  page:       number
  pageSize:   number
  clientMap:  Record<string, string>
}

function formatBudget(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function CampaignsTable({ campaigns, total, page, pageSize, clientMap }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const [optimisticCampaigns, removeOptimistic] = useOptimistic(
    campaigns,
    (state: Campaign[], deletedId: string) => state.filter((c) => c.id !== deletedId)
  )
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null)
  const [, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleDelete = (campaign: Campaign) => {
    startTransition(async () => {
      removeOptimistic(campaign.id)
      const result = await deleteCampaign(campaign.id)
      if (result.error) toast.error(result.error)
      else toast.success(`"${campaign.name}" deleted`)
    })
  }

  if (campaigns.length === 0 && total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-sm font-medium text-foreground mb-1">No campaigns yet</p>
        <p className="text-xs text-muted-foreground">Create your first campaign to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[220px]">Campaign</TableHead>
              <TableHead className="hidden md:table-cell">Client</TableHead>
              <TableHead className="hidden sm:table-cell w-24">Type</TableHead>
              <TableHead className="hidden sm:table-cell w-24">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Stage</TableHead>
              <TableHead className="hidden xl:table-cell">Dates</TableHead>
              <TableHead className="hidden lg:table-cell w-28">Budget</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticCampaigns.map((campaign) => (
              <TableRow key={campaign.id} className="group">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={ROUTES.CAMPAIGNS.DETAIL(campaign.id)}
                      className="font-medium text-sm text-foreground hover:text-brand transition-colors"
                    >
                      {campaign.name}
                    </Link>
                    {campaign.campaign_number && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {campaign.campaign_number}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {clientMap[campaign.client_id] ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <CampaignTypeBadge type={campaign.campaign_type} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <CampaignStatusBadge status={campaign.status} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <LifecycleStageBadge stage={campaign.lifecycle_stage} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDateRange(campaign.start_date, campaign.end_date)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {formatBudget(campaign.budget_amount, campaign.budget_currency)}
                  </span>
                </TableCell>
                <TableCell>
                  <CampaignRowActions
                    campaign={campaign}
                    onEdit={() => setEditCampaign(campaign)}
                    onDelete={() => handleDelete(campaign)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'No results'
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} campaign${total === 1 ? '' : 's'}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="icon-sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <CampaignEditSheet
        campaign={editCampaign}
        open={!!editCampaign}
        onOpenChange={(open) => { if (!open) setEditCampaign(null) }}
      />
    </div>
  )
}

export function CampaignsTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {['Campaign', 'Client', 'Type', 'Status', 'Stage', 'Dates', 'Budget', ''].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
              <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="size-7 rounded-xl" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
