'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, CalendarDays, DollarSign } from 'lucide-react'
import { CampaignStatusBadge, CampaignTypeBadge } from './campaign-status-badge'
import { CampaignEditSheet } from './campaign-edit-sheet'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import type { Campaign } from '@/lib/repositories/campaigns'

interface Props {
  campaign:   Campaign
  clientName: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CampaignDetailHeader({ campaign, clientName }: Props) {
  const [editOpen, setEditOpen] = useState(false)

  const spentPct = campaign.budget_amount > 0
    ? Math.min(100, (campaign.spent_amount / campaign.budget_amount) * 100)
    : 0

  const budgetFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: campaign.budget_currency,
    maximumFractionDigits: 0,
  })

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Back + actions row */}
        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.CAMPAIGNS.ROOT}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Campaigns
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        {/* Title row */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <CampaignTypeBadge   type={campaign.campaign_type} />
          </div>
          <h1 className="text-2xl font-semibold text-foreground leading-tight">
            {campaign.name}
          </h1>
          {campaign.campaign_number && (
            <p className="text-xs font-mono text-muted-foreground">{campaign.campaign_number}</p>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{clientName}</span>

          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
          </span>

          <span className="flex items-center gap-1.5">
            <DollarSign className="size-3.5" />
            {budgetFmt.format(campaign.budget_amount)} {campaign.budget_currency}
          </span>
        </div>

        {/* Budget progress */}
        {campaign.budget_amount > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Budget utilisation</span>
              <span>
                {budgetFmt.format(campaign.spent_amount)} / {budgetFmt.format(campaign.budget_amount)}
                {' '}({spentPct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  spentPct > 90 ? 'bg-destructive' : spentPct > 70 ? 'bg-amber-500' : 'bg-brand'
                }`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>
        )}

        {campaign.description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {campaign.description}
          </p>
        )}
      </div>

      <CampaignEditSheet campaign={campaign} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
