import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/repositories/campaigns'
import { getClientById } from '@/lib/repositories/clients'
import { listVendors } from '@/lib/repositories/vendors'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { CampaignDetailHeader } from '@/components/campaigns/campaign-detail-header'
import { CampaignLifecycleStepper } from '@/components/campaigns/campaign-lifecycle-stepper'
import { CampaignInfluencersPanel } from '@/components/campaigns/campaign-influencers-panel'
import type { VendorRef } from '@/components/campaigns/campaign-influencers-panel'
import { CampaignDeliverablesPanel } from '@/components/campaigns/campaign-deliverables-panel'

type Deliverable = Tables<'deliverables'>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const result = await getCampaignById(id)
  if (result.error || !result.data) return { title: 'Campaign' }
  return { title: result.data.name }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Parallel data fetch
  const [campaignResult, vendorsResult] = await Promise.all([
    getCampaignById(id),
    listVendors({ pageSize: 300, orderBy: 'created_at', orderDir: 'desc' }),
  ])

  if (campaignResult.error || !campaignResult.data) notFound()
  const campaign = campaignResult.data

  // Fetch client and deliverables in parallel
  const supabase = await createClient()
  const [clientResult, deliverablesRes] = await Promise.all([
    getClientById(campaign.client_id),
    supabase
      .from('deliverables')
      .select('*')
      .eq('campaign_id', id)
      .is('deleted_at', null)
      .order('due_date', { ascending: true }),
  ])

  const clientName  = clientResult.data?.name ?? '—'
  const deliverables: Deliverable[] = deliverablesRes.data ?? []
  const allVendors = vendorsResult.data?.rows ?? []

  // Build vendor refs for assigned influencers
  const assignedVendorIds = new Set(campaign.influencers.map((i) => i.vendor_id))
  const allVendorRefs: VendorRef[] = allVendors.map((v) => ({
    id:         v.id,
    name:       v.display_name ?? `${v.first_name} ${v.last_name}`.trim(),
    tier:       v.tier,
    avatar_url: v.avatar_url,
  }))

  const vendorsMap: Record<string, VendorRef> = Object.fromEntries(
    allVendorRefs.map((v) => [v.id, v])
  )

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-8">
      {/* Detail header: title, status, budget progress, edit */}
      <CampaignDetailHeader campaign={campaign} clientName={clientName} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / main area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Lifecycle stepper */}
          <section className="rounded-2xl border border-border p-5">
            <CampaignLifecycleStepper
              campaignId={campaign.id}
              currentStage={campaign.lifecycle_stage}
            />
          </section>

          {/* Deliverables */}
          <section className="rounded-2xl border border-border p-5">
            <Suspense>
              <CampaignDeliverablesPanel
                campaignId={campaign.id}
                deliverables={deliverables}
                influencers={campaign.influencers}
                vendorsMap={vendorsMap}
              />
            </Suspense>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          {/* Influencer assignments */}
          <section className="rounded-2xl border border-border p-5">
            <Suspense>
              <CampaignInfluencersPanel
                campaignId={campaign.id}
                influencers={campaign.influencers}
                vendors={allVendorRefs}
                vendorsMap={vendorsMap}
              />
            </Suspense>
          </section>

          {/* KPI targets */}
          {(campaign.target_reach || campaign.target_impressions || campaign.target_engagements) && (
            <section className="rounded-2xl border border-border p-5 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">KPI Targets</h3>
              <dl className="flex flex-col gap-2">
                {campaign.target_reach && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Reach</dt>
                    <dd className="font-medium">{campaign.target_reach.toLocaleString()}</dd>
                  </div>
                )}
                {campaign.target_impressions && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Impressions</dt>
                    <dd className="font-medium">{campaign.target_impressions.toLocaleString()}</dd>
                  </div>
                )}
                {campaign.target_engagements && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Engagements</dt>
                    <dd className="font-medium">{campaign.target_engagements.toLocaleString()}</dd>
                  </div>
                )}
                {campaign.target_clicks && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Clicks</dt>
                    <dd className="font-medium">{campaign.target_clicks.toLocaleString()}</dd>
                  </div>
                )}
                {campaign.target_conversions && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Conversions</dt>
                    <dd className="font-medium">{campaign.target_conversions.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
