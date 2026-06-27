import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { CampaignsListSection } from "@/features/campaigns/components/campaigns-list-section";
import { NewCampaignDialog } from "@/features/campaigns/components/new-campaign-dialog";
import {
  getCampaignFormOptions,
  getCampaignsKpis,
  getCampaignsList,
  type CampaignsKpis,
} from "@/features/campaigns/queries";

type CampaignsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";

  let list;
  let formOptions;
  let errorMessage: string | null = null;
  let kpis: CampaignsKpis | null = null;

  try {
    kpis = await getCampaignsKpis();
  } catch {
    kpis = null;
  }

  try {
    [list, formOptions] = await Promise.all([
      getCampaignsList({ page, search }),
      getCampaignFormOptions(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaigns.";
    list = {
      campaigns: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
    formOptions = EMPTY_CAMPAIGN_FORM_OPTIONS;
  }

  const { campaigns, total, totalPages } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1 ? "1 campaign" : `${total} campaigns` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell title="Campaigns" platformV6>
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Campaigns"
          description="Plan and manage campaign headers and lines across the brand hierarchy."
          actions={<NewCampaignDialog {...formOptions} />}
        />

        {kpis ? <CampaignsKpiStrip kpis={kpis} /> : null}

        <CampaignsListSection
          campaigns={campaigns}
          meta={meta}
          hasSearch={hasSearch}
          page={list.page}
          totalPages={totalPages}
          search={search}
          errorSlot={
            errorMessage ? (
              <div className="border-b px-4 py-3">
                <PageAlert>{errorMessage}</PageAlert>
              </div>
            ) : null
          }
        />
      </PlatformV6Page>
    </DashboardShell>
  );
}
