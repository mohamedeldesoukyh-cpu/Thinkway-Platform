'use client'

import { useActionState, useEffect } from 'react'
import { updateCampaign } from '@/app/actions/campaigns'
import type { CampaignActionResult } from '@/app/actions/campaigns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { CAMPAIGN_TYPES, CURRENCIES, TEAMS, CAMPAIGN_LIFECYCLE_STAGES } from '@/lib/constants/app'
import type { Campaign } from '@/lib/repositories/campaigns'

interface Props {
  campaign:     Campaign | null
  open:         boolean
  onOpenChange: (open: boolean) => void
}

const STATUSES = [
  { value: 'draft',     label: 'Draft' },
  { value: 'planning',  label: 'Planning' },
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function CampaignEditSheet({ campaign, open, onOpenChange }: Props) {
  const boundAction = campaign
    ? updateCampaign.bind(null, campaign.id)
    : async (_p: unknown, _f: FormData) => ({ error: 'No campaign' } as CampaignActionResult)

  const [state, action, pending] = useActionState(boundAction, {} as CampaignActionResult)

  useEffect(() => {
    if (state.success) onOpenChange(false)
  }, [state.success, onOpenChange])

  const fe = (f: string) => state.fieldErrors?.[f]?.[0]

  if (!campaign) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>Edit Campaign</SheetTitle>
          <SheetDescription>{campaign.name}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form id="edit-campaign-form" action={action} className="flex flex-col gap-5 px-6 py-5">
            {state.error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-name">Name <span className="text-destructive">*</span></Label>
                <Input id="edit-cam-name" name="name" defaultValue={campaign.name} />
                {fe('name') && <p className="text-xs text-destructive">{fe('name')}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-type">Type</Label>
                <Select name="campaign_type" defaultValue={campaign.campaign_type}>
                  <SelectTrigger id="edit-cam-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-status">Status</Label>
                <Select name="status" defaultValue={campaign.status}>
                  <SelectTrigger id="edit-cam-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-start">Start date</Label>
                <Input
                  id="edit-cam-start"
                  name="start_date"
                  type="date"
                  defaultValue={campaign.start_date}
                />
                {fe('start_date') && <p className="text-xs text-destructive">{fe('start_date')}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-end">End date</Label>
                <Input
                  id="edit-cam-end"
                  name="end_date"
                  type="date"
                  defaultValue={campaign.end_date}
                />
                {fe('end_date') && <p className="text-xs text-destructive">{fe('end_date')}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-budget">Budget</Label>
                <Input
                  id="edit-cam-budget"
                  name="budget_amount"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={campaign.budget_amount}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-currency">Currency</Label>
                <Select name="budget_currency" defaultValue={campaign.budget_currency}>
                  <SelectTrigger id="edit-cam-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-stage">Lifecycle stage</Label>
                <Select name="lifecycle_stage" defaultValue={String(campaign.lifecycle_stage)}>
                  <SelectTrigger id="edit-cam-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_LIFECYCLE_STAGES.map((s) => (
                      <SelectItem key={s.step} value={String(s.step)}>
                        {s.step}. {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-team">Team</Label>
                <Select name="team" defaultValue={campaign.team ?? ''}>
                  <SelectTrigger id="edit-cam-team">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {TEAMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-desc">Description</Label>
                <Textarea
                  id="edit-cam-desc"
                  name="description"
                  defaultValue={campaign.description ?? ''}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-goals">Goals</Label>
                <Textarea
                  id="edit-cam-goals"
                  name="goals"
                  defaultValue={campaign.goals ?? ''}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-cam-brief">Brief URL</Label>
                <Input
                  id="edit-cam-brief"
                  name="brief_url"
                  type="url"
                  placeholder="https://..."
                  defaultValue={campaign.brief_url ?? ''}
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-campaign-form"
            disabled={pending}
            className="bg-brand hover:bg-brand/90 text-white"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
