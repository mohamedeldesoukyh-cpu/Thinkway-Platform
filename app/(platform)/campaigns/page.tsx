import { Suspense } from 'react'
import type { Metadata } from 'next'
import { listCampaigns } from '@/lib/repositories/campaigns'
import { listClients } from '@/lib/repositories/clients'
import type { CampaignStatusDb, CampaignTypeDb } from '@/types/database'
import { CampaignsTable, CampaignsTableSkeleton } from '@/components/campaigns/campaigns-table'
import { CampaignFilters } from '@/components/campaigns/campaign-filters'
import { CampaignAddButton } from '@/components/campaigns/campaign-add-button'

export const metadata: Metadata = {
  title: 'Campaigns',
}

const PAGE_SIZE = 25

interface SearchParams {
  search?: string
  status?: string
  type?:   string
  team?:   string
  page?:   string
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { search, status, type, team, page } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)

  const [campaignsResult, clientsResult] = await Promise.all([
    listCampaigns({
      page:      currentPage,
      pageSize:  PAGE_SIZE,
      search:    search    || undefined,
      status:    (status   as CampaignStatusDb) || undefined,
      team:      team      || undefined,
    }),
    listClients({ pageSize: 500, orderBy: 'name', orderDir: 'asc' }),
  ])

  if (campaignsResult.error) throw new Error(campaignsResult.error)

  const { rows: campaigns, total } = campaignsResult.data!
  const clients = clientsResult.data?.rows ?? []

  // Build client ID → name map for the table
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'No campaigns' : `${total} campaign${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <CampaignAddButton clients={clients} />
      </div>

      {/* Filters */}
      <Suspense>
        <CampaignFilters
          search={search}
          status={status}
          type={type}
          team={team}
        />
      </Suspense>

      {/* Table */}
      <Suspense fallback={<CampaignsTableSkeleton />}>
        <CampaignsTable
          campaigns={campaigns}
          total={total}
          page={currentPage}
          pageSize={PAGE_SIZE}
          clientMap={clientMap}
        />
      </Suspense>
    </div>
  )
}
