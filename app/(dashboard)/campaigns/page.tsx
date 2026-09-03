import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignsListMasthead } from "@/features/campaigns/components/campaigns-list-masthead";
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
    const [kpisResult, listResult, formOptionsResult] = await Promise.allSettled([
      getCampaignsKpis(),
      getCampaignsList({ page, search }),
      getCampaignFormOptions(),
    ]);
    kpis = kpisResult.status === "fulfilled" ? kpisResult.value : null;
    list = listResult.status === "fulfilled" ? listResult.value : null;
    formOptions =
      formOptionsResult.status === "fulfilled" ? formOptionsResult.value : null;

    if (!list || !formOptions) {
      throw listResult.status === "rejected"
        ? listResult.reason
        : formOptionsResult.status === "rejected"
          ? formOptionsResult.reason
          : new Error("Failed to load campaigns.");
    }
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

  const { campaigns, total, totalPages, pageSize } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1
      ? "1 campaign"
      : `${total} campaigns` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell title="Campaigns" platformV6>
      <div className="campaigns-list-suite">
        {kpis ? (
          <CampaignsListMasthead
            kpis={kpis}
            actions={<NewCampaignDialog {...formOptions} />}
          />
        ) : (
          <div className="tw-mast">
            <div className="tw-mh">
              <h1>Campaigns</h1>
              <span className="sub">
                Campaign command center — open a campaign to continue operational
                work in its workspace
              </span>
              <span className="tw-sp" />
              <NewCampaignDialog {...formOptions} />
            </div>
          </div>
        )}

        <CampaignsListSection
          campaigns={campaigns}
          meta={meta}
          hasSearch={hasSearch}
          page={list.page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          search={search}
          errorSlot={
            errorMessage ? (
              <div className="tw-note bad">{errorMessage}</div>
            ) : null
          }
        />
      </div>
    </DashboardShell>
  );
}
