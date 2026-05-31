'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClient } from '@/app/actions/clients'
import type { Client } from '@/lib/repositories/clients'
import { StatusBadge, TierBadge } from './status-badge'
import { ClientRowActions } from './client-row-actions'
import { ClientEditSheet } from './client-edit-sheet'
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

interface Props {
  clients: Client[]
  total: number
  page: number
  pageSize: number
}

function formatIndustry(industry: string): string {
  return industry
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ClientsTable({ clients, total, page, pageSize }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [optimisticClients, removeOptimistic] = useOptimistic(
    clients,
    (state: Client[], deletedId: string) => state.filter((c) => c.id !== deletedId)
  )
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleDelete = (client: Client) => {
    startTransition(async () => {
      removeOptimistic(client.id)
      const result = await deleteClient(client.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${client.name} deleted`)
      }
    })
  }

  if (clients.length === 0 && total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-sm font-medium text-foreground mb-1">No clients yet</p>
        <p className="text-xs text-muted-foreground">Add your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[240px]">Client</TableHead>
              <TableHead className="hidden md:table-cell">Industry</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Tier</TableHead>
              <TableHead className="hidden lg:table-cell">Currency</TableHead>
              <TableHead className="hidden xl:table-cell">Group</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticClients.map((client) => (
              <TableRow key={client.id} className="group">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground text-sm">{client.name}</span>
                    {client.trading_name && (
                      <span className="text-xs text-muted-foreground">{client.trading_name}</span>
                    )}
                    {client.website && (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline truncate max-w-[200px]"
                      >
                        {client.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {formatIndustry(client.industry)}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={client.status} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <TierBadge tier={client.tier} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">{client.currency}</span>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
                    {client.parent_group ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <ClientRowActions
                    client={client}
                    onEdit={() => setEditClient(client)}
                    onDelete={() => handleDelete(client)}
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
          {total === 0 ? 'No results' : `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} of ${total} client${total === 1 ? '' : 's'}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <ClientEditSheet
        client={editClient}
        open={!!editClient}
        onOpenChange={(open) => {
          if (!open) setEditClient(null)
        }}
      />
    </div>
  )
}

export function ClientsTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[240px]">Client</TableHead>
            <TableHead className="hidden md:table-cell">Industry</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Tier</TableHead>
            <TableHead className="hidden lg:table-cell">Currency</TableHead>
            <TableHead className="hidden xl:table-cell">Group</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-36" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-10" /></TableCell>
              <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="size-7 rounded-xl" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
