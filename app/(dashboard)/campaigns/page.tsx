import { Suspense } from "react";

import { PageAlert } from "@/components/ui/page-alert";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
import { CampaignsTable } from "@/features/campaigns/components/campaigns-table";
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
    formOptions = {
      brands: [],
      accountManagers: [],
      masterData: {
        categories: [],
        subcategories: [],
        currencies: [],
        countries: [],
        teams: [],
        reportTypes: [],
        paymentTerms: [],
        vrRates: [],
      },
    };
  }

  const { campaigns, total, totalPages } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1 ? "1 campaign" : `${total} campaigns` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell
      title="Campaigns"
      description="Plan and manage campaign headers and lines across the brand hierarchy."
      actions={<NewCampaignDialog {...formOptions} />}
    >
      {kpis ? <CampaignsKpiStrip kpis={kpis} className="mb-4" /> : null}

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                All campaigns
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta}</p>
            </div>
            <Suspense fallback={null}>
              <CampaignsSearch />
            </Suspense>
          </div>
        }
      >
        {errorMessage ? (
          <div className="border-b border-border/40 px-4 py-3">
            <PageAlert>{errorMessage}</PageAlert>
          </div>
        ) : null}

        {campaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <CampaignsTable campaigns={campaigns} />
            <div className="border-t border-border/40 px-4 py-3 md:px-5">
              <CampaignsPagination
                page={list.page}
                totalPages={totalPages}
                search={search}
              />
            </div>
          </>
        )}
      </OperationalTableSection>
    </DashboardShell>
  );
}
