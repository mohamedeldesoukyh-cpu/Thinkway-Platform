'use client'

import { useActionState, useTransition, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createDeliverable, updateDeliverableStatus } from '@/app/actions/campaigns'
import type { CampaignActionResult } from '@/app/actions/campaigns'
import { DeliverableStatusBadge } from './campaign-status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tables, DeliverableStatusDb } from '@/types/database'
import type { CampaignInfluencer } from '@/lib/repositories/campaigns'
import type { VendorRef } from './campaign-influencers-panel'

type Deliverable = Tables<'deliverables'>

interface Props {
  campaignId:  string
  deliverables: Deliverable[]
  influencers:  CampaignInfluencer[]
  vendorsMap:   Record<string, VendorRef>
}

const DELIVERABLE_TYPE_OPTIONS = [
  { value: 'instagram_post',      label: 'Instagram Post',      platform: 'instagram' },
  { value: 'instagram_story',     label: 'Instagram Story',     platform: 'instagram' },
  { value: 'instagram_reel',      label: 'Instagram Reel',      platform: 'instagram' },
  { value: 'instagram_carousel',  label: 'Instagram Carousel',  platform: 'instagram' },
  { value: 'tiktok_video',        label: 'TikTok Video',        platform: 'tiktok' },
  { value: 'youtube_video',       label: 'YouTube Video',       platform: 'youtube' },
  { value: 'youtube_short',       label: 'YouTube Short',       platform: 'youtube' },
  { value: 'twitter_post',        label: 'X (Twitter) Post',    platform: 'x' },
  { value: 'facebook_post',       label: 'Facebook Post',       platform: 'facebook' },
  { value: 'facebook_reel',       label: 'Facebook Reel',       platform: 'facebook' },
  { value: 'linkedin_post',       label: 'LinkedIn Post',       platform: 'linkedin' },
  { value: 'blog_post',           label: 'Blog Post',           platform: null },
  { value: 'podcast_mention',     label: 'Podcast Mention',     platform: null },
  { value: 'live_stream',         label: 'Live Stream',         platform: null },
  { value: 'other',               label: 'Other',               platform: null },
] as const

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'x',         label: 'X (Twitter)' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'snapchat',  label: 'Snapchat' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'threads',   label: 'Threads' },
]

const DELIVERABLE_STATUSES: { value: DeliverableStatusDb; label: string }[] = [
  { value: 'not_started',        label: 'Not started' },
  { value: 'in_progress',        label: 'In progress' },
  { value: 'submitted',          label: 'Submitted' },
  { value: 'in_review',          label: 'In review' },
  { value: 'revision_requested', label: 'Revision requested' },
  { value: 'approved',           label: 'Approved' },
  { value: 'scheduled',          label: 'Scheduled' },
  { value: 'published',          label: 'Published' },
  { value: 'live',               label: 'Live' },
  { value: 'rejected',           label: 'Rejected' },
  { value: 'cancelled',          label: 'Cancelled' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const INITIAL: CampaignActionResult = {}

export function CampaignDeliverablesPanel({
  campaignId,
  deliverables,
  influencers,
  vendorsMap,
}: Props) {
  const boundCreate = createDeliverable.bind(null, campaignId)
  const [state, addAction, addPending] = useActionState(boundCreate, INITIAL)
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')

  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    const opt = DELIVERABLE_TYPE_OPTIONS.find((o) => o.value === type)
    if (opt?.platform) setSelectedPlatform(opt.platform)
    else setSelectedPlatform('')
  }

  const handleStatusChange = (deliverable: Deliverable, status: string) => {
    startTransition(async () => {
      const result = await updateDeliverableStatus(deliverable.id, campaignId, status)
      if (result.error) toast.error(result.error)
    })
  }

  const influencerMap = Object.fromEntries(influencers.map((ci) => [ci.id, ci]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Deliverables
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({deliverables.length})
          </span>
        </h3>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form
          action={(fd) => { addAction(fd); setShowForm(false); setSelectedType(''); setSelectedPlatform('') }}
          className="rounded-xl border border-brand/20 bg-brand/5 p-4 flex flex-col gap-3"
        >
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}

          {/* Hidden platform value */}
          <input type="hidden" name="platform" value={selectedPlatform} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs">Type <span className="text-destructive">*</span></Label>
              <Select name="type" value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors?.type?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.type[0]}</p>
              )}
            </div>

            {/* Platform — shown if auto-inferred or empty (needs manual selection) */}
            {!selectedPlatform && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs">Platform <span className="text-destructive">*</span></Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(v) => setSelectedPlatform(v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Due date <span className="text-destructive">*</span></Label>
              <Input name="due_date" type="date" className="h-8 text-sm" />
              {state.fieldErrors?.due_date?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.due_date[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Linked influencer</Label>
              <Select name="campaign_influencer_id" defaultValue="">
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {influencers.map((ci) => (
                    <SelectItem key={ci.id} value={ci.id}>
                      {vendorsMap[ci.vendor_id]?.name ?? ci.vendor_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea name="description" rows={2} className="text-sm resize-none" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setSelectedType(''); setSelectedPlatform('') }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addPending || !selectedType || !selectedPlatform}
              className="h-7 text-xs bg-brand hover:bg-brand/90 text-white"
            >
              {addPending ? 'Adding…' : 'Add deliverable'}
            </Button>
          </div>
        </form>
      )}

      {/* Deliverable list */}
      {deliverables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-xs text-muted-foreground">No deliverables yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {deliverables.map((d) => {
            const ciVendor = d.campaign_influencer_id
              ? vendorsMap[influencerMap[d.campaign_influencer_id]?.vendor_id ?? '']
              : null
            const typeLabel = DELIVERABLE_TYPE_OPTIONS.find((o) => o.value === d.type)?.label ?? d.type

            return (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{typeLabel}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground capitalize">{d.platform}</span>
                    {ciVendor && (
                      <>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-xs text-muted-foreground">{ciVendor.name}</span>
                      </>
                    )}
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-muted-foreground">Due {formatDate(d.due_date)}</span>
                  </div>
                </div>

                <Select
                  defaultValue={d.status}
                  onValueChange={(v) => handleStatusChange(d, v)}
                >
                  <SelectTrigger className="h-6 w-36 text-xs border-0 bg-transparent p-0 shadow-none">
                    <DeliverableStatusBadge status={d.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
