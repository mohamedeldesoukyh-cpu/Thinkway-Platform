import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
import { CampaignsTable } from "@/features/campaigns/components/campaigns-table";
import { NewCampaignDialog } from "@/features/campaigns/components/new-campaign-dialog";
import {
  getCampaignFormOptions,
  getCampaignsList,
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
    formOptions = { clients: [], accountManagers: [] };
  }

  const { campaigns, total, totalPages } = list;
  const hasSearch = Boolean(search);

  return (
    <DashboardShell
      title="Campaigns"
      description="Plan and manage influencer campaigns across clients and platforms."
      actions={<NewCampaignDialog {...formOptions} />}
    >
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>All campaigns</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total === 1 ? "1 campaign" : `${total} campaigns`}
              {hasSearch ? ` matching "${search}"` : ""}
            </p>
          </div>
          <Suspense fallback={null}>
            <CampaignsSearch />
          </Suspense>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {campaigns.length === 0 ? (
            <CampaignsEmptyState hasSearch={hasSearch} />
          ) : (
            <>
              <CampaignsTable campaigns={campaigns} />
              <CampaignsPagination
                page={list.page}
                totalPages={totalPages}
                search={search}
              />
            </>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
