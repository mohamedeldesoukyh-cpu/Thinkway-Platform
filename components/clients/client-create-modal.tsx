'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createClient } from '@/app/actions/clients'
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
import { CLIENT_CATEGORIES, PRESET_GROUPS, CURRENCIES } from '@/lib/constants/app'
import type { ClientActionResult } from '@/app/actions/clients'

interface Props {
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

const INITIAL_STATE: ClientActionResult = {}

export function ClientCreateModal({ open, onOpenChange }: Props) {
  const [state, action, pending] = useActionState(createClient, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  // Add primary contact as JSON
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactRole, setContactRole] = useState('')

  const contactsJson = JSON.stringify(
    contactName && contactEmail
      ? [{ name: contactName, email: contactEmail, phone: contactPhone || null, role: contactRole || null, is_primary: true }]
      : []
  )

  useEffect(() => {
    if (state.success) {
      onOpenChange(false)
      formRef.current?.reset()
      setContactName('')
      setContactEmail('')
      setContactPhone('')
      setContactRole('')
    }
  }, [state.success, onOpenChange])

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription>Fill in the details to create a new client record.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="flex flex-col gap-5">
          {/* Hidden contacts field */}
          <input type="hidden" name="contacts" value={contactsJson} />

          {state.error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          {/* Core fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Client name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" placeholder="e.g. Alshaya Group" autoFocus />
              {fieldError('name') && (
                <p className="text-xs text-destructive">{fieldError('name')}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trading_name">Trading name</Label>
              <Input id="trading_name" name="trading_name" placeholder="Optional" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="industry">Industry <span className="text-destructive">*</span></Label>
              <Select name="industry" defaultValue="">
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
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
              <Label htmlFor="tier">Tier</Label>
              <Select name="tier" defaultValue="standard">
                <SelectTrigger id="tier">
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
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue="prospect">
                <SelectTrigger id="status">
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
              <Label htmlFor="parent_group">Parent group</Label>
              <Select name="parent_group" defaultValue="">
                <SelectTrigger id="parent_group">
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
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" placeholder="https://..." type="url" />
              {fieldError('website') && (
                <p className="text-xs text-destructive">{fieldError('website')}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency" defaultValue="USD">
                <SelectTrigger id="currency">
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
              <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
              <Input
                id="payment_terms_days"
                name="payment_terms_days"
                type="number"
                defaultValue={30}
                min={0}
                max={365}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the client..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* Primary contact */}
          <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Primary contact (optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact_name" className="text-xs">Name</Label>
                <Input
                  id="contact_name"
                  placeholder="Full name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact_email" className="text-xs">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="email@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact_phone" className="text-xs">Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  placeholder="+1 000 000 0000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact_role" className="text-xs">Role</Label>
                <Input
                  id="contact_role"
                  placeholder="e.g. Marketing Manager"
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand/90 text-white">
              {pending ? 'Creating…' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
