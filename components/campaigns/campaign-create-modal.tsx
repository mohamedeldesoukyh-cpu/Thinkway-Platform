'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign } from '@/app/actions/campaigns'
import type { CampaignActionResult } from '@/app/actions/campaigns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { CAMPAIGN_TYPES, CURRENCIES, TEAMS } from '@/lib/constants/app'
import { ROUTES } from '@/lib/constants/routes'
import type { Client } from '@/lib/repositories/clients'

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  clients:       Pick<Client, 'id' | 'name'>[]
}

const STATUSES = [
  { value: 'draft',    label: 'Draft' },
  { value: 'planning', label: 'Planning' },
  { value: 'active',   label: 'Active' },
]

const INITIAL: CampaignActionResult = {}

export function CampaignCreateModal({ open, onOpenChange, clients }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createCampaign, INITIAL)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success && state.id) {
      onOpenChange(false)
      formRef.current?.reset()
      router.push(ROUTES.CAMPAIGNS.DETAIL(state.id))
    }
  }, [state.success, state.id, onOpenChange, router])

  const fe = (f: string) => state.fieldErrors?.[f]?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>Create a campaign and assign a client, budget, and timeline.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="flex flex-col gap-5">
          {state.error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Campaign name */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="cam-name">Campaign name <span className="text-destructive">*</span></Label>
              <Input id="cam-name" name="name" placeholder="e.g. Ramadan 2025 Beauty Push" autoFocus />
              {fe('name') && <p className="text-xs text-destructive">{fe('name')}</p>}
            </div>

            {/* Client */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="cam-client">Client <span className="text-destructive">*</span></Label>
              <Select name="client_id" defaultValue="">
                <SelectTrigger id="cam-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fe('client_id') && <p className="text-xs text-destructive">{fe('client_id')}</p>}
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-type">Type</Label>
              <Select name="campaign_type" defaultValue="fixed">
                <SelectTrigger id="cam-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-status">Status</Label>
              <Select name="status" defaultValue="draft">
                <SelectTrigger id="cam-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-start">Start date <span className="text-destructive">*</span></Label>
              <Input id="cam-start" name="start_date" type="date" />
              {fe('start_date') && <p className="text-xs text-destructive">{fe('start_date')}</p>}
            </div>

            {/* End date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-end">End date <span className="text-destructive">*</span></Label>
              <Input id="cam-end" name="end_date" type="date" />
              {fe('end_date') && <p className="text-xs text-destructive">{fe('end_date')}</p>}
            </div>

            {/* Budget */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-budget">Budget</Label>
              <Input id="cam-budget" name="budget_amount" type="number" min={0} step={0.01} defaultValue={0} />
            </div>

            {/* Currency */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-currency">Currency</Label>
              <Select name="budget_currency" defaultValue="USD">
                <SelectTrigger id="cam-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label} ({c.symbol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cam-team">Team</Label>
              <Select name="team" defaultValue="">
                <SelectTrigger id="cam-team">
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

            {/* Description */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="cam-desc">Description</Label>
              <Textarea
                id="cam-desc"
                name="description"
                placeholder="Brief overview of the campaign…"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand/90 text-white">
              {pending ? 'Creating…' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
