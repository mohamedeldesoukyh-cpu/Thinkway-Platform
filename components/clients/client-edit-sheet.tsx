'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { updateClient } from '@/app/actions/clients'
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
import { CLIENT_CATEGORIES, PRESET_GROUPS, CURRENCIES } from '@/lib/constants/app'
import type { Client } from '@/lib/repositories/clients'

interface Props {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TIERS = [
  { value: 'standard',   label: 'Standard' },
  { value: 'premium',    label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'strategic',  label: 'Strategic' },
]

const STATUSES = [
  { value: 'prospect',  label: 'Prospect' },
  { value: 'active',    label: 'Active' },
  { value: 'inactive',  label: 'Inactive' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'churned',   label: 'Churned' },
]

export function ClientEditSheet({ client, open, onOpenChange }: Props) {
  const boundAction = client
    ? updateClient.bind(null, client.id)
    : async (_p: unknown, _f: FormData) => ({ error: 'No client selected' })

  const [state, action, pending] = useActionState(boundAction, {})

  useEffect(() => {
    if (state.success) {
      onOpenChange(false)
    }
  }, [state.success, onOpenChange])

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0]

  if (!client) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>Edit Client</SheetTitle>
          <SheetDescription>{client.name}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form id="edit-client-form" action={action} className="flex flex-col gap-5 px-6 py-5">
            {/* Hidden contacts passthrough — preserve existing contacts on update */}
            <input type="hidden" name="contacts" value="[]" />

            {state.error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Client name <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={client.name}
                />
                {fieldError('name') && (
                  <p className="text-xs text-destructive">{fieldError('name')}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-trading_name">Trading name</Label>
                <Input
                  id="edit-trading_name"
                  name="trading_name"
                  defaultValue={client.trading_name ?? ''}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-industry">Industry <span className="text-destructive">*</span></Label>
                <Select name="industry" defaultValue={client.industry}>
                  <SelectTrigger id="edit-industry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError('industry') && (
                  <p className="text-xs text-destructive">{fieldError('industry')}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-tier">Tier</Label>
                <Select name="tier" defaultValue={client.tier}>
                  <SelectTrigger id="edit-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <Select name="status" defaultValue={client.status}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-parent_group">Parent group</Label>
                <Select name="parent_group" defaultValue={client.parent_group ?? ''}>
                  <SelectTrigger id="edit-parent_group">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {PRESET_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  name="website"
                  type="url"
                  placeholder="https://..."
                  defaultValue={client.website ?? ''}
                />
                {fieldError('website') && (
                  <p className="text-xs text-destructive">{fieldError('website')}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-currency">Currency</Label>
                <Select name="currency" defaultValue={client.currency}>
                  <SelectTrigger id="edit-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-payment_terms_days">Payment terms (days)</Label>
                <Input
                  id="edit-payment_terms_days"
                  name="payment_terms_days"
                  type="number"
                  defaultValue={client.payment_terms_days ?? 30}
                  min={0}
                  max={365}
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={client.description ?? ''}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={client.notes ?? ''}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-client-form"
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
