'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientCreateModal } from './client-create-modal'

export function ClientAddButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-brand hover:bg-brand/90 text-white gap-1.5"
      >
        <Plus className="size-4" />
        Add Client
      </Button>
      <ClientCreateModal open={open} onOpenChange={setOpen} />
    </>
  )
}
