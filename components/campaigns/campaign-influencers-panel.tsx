'use client'

import { useActionState, useOptimistic, useTransition, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { addInfluencer, removeInfluencer, updateInfluencerStatus } from '@/app/actions/campaigns'
import type { CampaignActionResult } from '@/app/actions/campaigns'
import { CiStatusBadge } from './campaign-status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES } from '@/lib/constants/app'
import type { CampaignInfluencer } from '@/lib/repositories/campaigns'
import type { CiStatusDb } from '@/types/database'

export interface VendorRef {
  id:          string
  name:        string
  tier:        string
  avatar_url:  string | null
}

interface Props {
  campaignId:   string
  influencers:  CampaignInfluencer[]
  vendors:      VendorRef[]
  vendorsMap:   Record<string, VendorRef>
}

const CI_STATUSES: { value: CiStatusDb; label: string }[] = [
  { value: 'invited',   label: 'Invited' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active',    label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined',  label: 'Declined' },
  { value: 'removed',   label: 'Removed' },
]

const INITIAL: CampaignActionResult = {}

export function CampaignInfluencersPanel({
  campaignId,
  influencers,
  vendors,
  vendorsMap,
}: Props) {
  const boundAdd = addInfluencer.bind(null, campaignId)
  const [state, addAction, addPending] = useActionState(boundAdd, INITIAL)

  const [optimisticInfluencers, removeOptimistic] = useOptimistic(
    influencers,
    (prev: CampaignInfluencer[], removedId: string) => prev.filter((i) => i.id !== removedId)
  )
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)

  const handleRemove = (ci: CampaignInfluencer) => {
    startTransition(async () => {
      removeOptimistic(ci.id)
      const result = await removeInfluencer(campaignId, ci.vendor_id)
      if (result.error) toast.error(result.error)
      else toast.success('Influencer removed')
    })
  }

  const handleStatusChange = (ci: CampaignInfluencer, status: string) => {
    startTransition(async () => {
      const result = await updateInfluencerStatus(ci.id, campaignId, status)
      if (result.error) toast.error(result.error)
    })
  }

  const assignedVendorIds = new Set(optimisticInfluencers.map((i) => i.vendor_id))
  const availableVendors  = vendors.filter((v) => !assignedVendorIds.has(v.id))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Influencers
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({optimisticInfluencers.length})
          </span>
        </h3>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="h-7 gap-1 text-xs"
          >
            <UserPlus className="size-3" />
            Assign
          </Button>
        )}
      </div>

      {/* Add influencer form */}
      {showForm && (
        <form
          action={(fd) => {
            addAction(fd)
            setShowForm(false)
          }}
          className="rounded-xl border border-brand/20 bg-brand/5 p-4 flex flex-col gap-3"
        >
          {state.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs">Influencer <span className="text-destructive">*</span></Label>
              <Select name="vendor_id" defaultValue="">
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select influencer" />
                </SelectTrigger>
                <SelectContent>
                  {availableVendors.length === 0 ? (
                    <SelectItem value="_none" disabled>No available influencers</SelectItem>
                  ) : (
                    availableVendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {state.fieldErrors?.vendor_id?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.vendor_id[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Agreed rate</Label>
              <Input name="agreed_rate" type="number" min={0} step={0.01} defaultValue={0} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Currency</Label>
              <Select name="currency" defaultValue="USD">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="h-7 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={addPending} className="h-7 text-xs bg-brand hover:bg-brand/90 text-white">
              {addPending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </form>
      )}

      {/* Influencer list */}
      {optimisticInfluencers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-xs text-muted-foreground">No influencers assigned yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {optimisticInfluencers.map((ci) => {
            const vendor = vendorsMap[ci.vendor_id]
            return (
              <div
                key={ci.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {vendor?.name ?? ci.vendor_id.slice(0, 8) + '…'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ci.agreed_rate.toLocaleString()} {ci.currency}
                  </p>
                </div>

                <Select
                  defaultValue={ci.status}
                  onValueChange={(v) => handleStatusChange(ci, v)}
                >
                  <SelectTrigger className="h-6 w-28 text-xs border-0 bg-transparent p-0 shadow-none">
                    <CiStatusBadge status={ci.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {CI_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={() => handleRemove(ci)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
