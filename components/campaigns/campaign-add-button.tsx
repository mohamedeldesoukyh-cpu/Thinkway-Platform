'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CampaignCreateModal } from './campaign-create-modal'
import type { Client } from '@/lib/repositories/clients'

interface Props {
  clients: Pick<Client, 'id' | 'name'>[]
}

export function CampaignAddButton({ clients }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-brand hover:bg-brand/90 text-white gap-1.5"
      >
        <Plus className="size-4" />
        New Campaign
      </Button>
      <CampaignCreateModal open={open} onOpenChange={setOpen} clients={clients} />
    </>
  )
}
