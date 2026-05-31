import { Suspense } from 'react'
import type { Metadata } from 'next'
import { listClients } from '@/lib/repositories/clients'
import type { ClientStatusDb, ClientTierDb } from '@/types/database'
import { ClientsTable, ClientsTableSkeleton } from '@/components/clients/clients-table'
import { ClientFilters } from '@/components/clients/client-filters'
import { ClientAddButton } from '@/components/clients/client-add-button'

export const metadata: Metadata = {
  title: 'Clients',
}

const PAGE_SIZE = 25

interface SearchParams {
  search?: string
  status?: string
  tier?: string
  industry?: string
  page?: string
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { search, status, tier, industry, page } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)

  const result = await listClients({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: (status as ClientStatusDb) || undefined,
    tier: (tier as ClientTierDb) || undefined,
    industry: industry || undefined,
  })

  if (result.error) {
    throw new Error(result.error)
  }

  const { rows: clients, total } = result.data!

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'No clients' : `${total} client${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <ClientAddButton />
      </div>

      {/* Filters */}
      <Suspense>
        <ClientFilters
          search={search}
          status={status}
          tier={tier}
          industry={industry}
        />
      </Suspense>

      {/* Table */}
      <Suspense fallback={<ClientsTableSkeleton />}>
        <ClientsTable
          clients={clients}
          total={total}
          page={currentPage}
          pageSize={PAGE_SIZE}
        />
      </Suspense>
    </div>
  )
}
