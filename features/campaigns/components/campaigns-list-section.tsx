"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";

import { OperationalTableControls } from "@/components/tables/operational-table-controls";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
import { CampaignsListNavSync } from "@/features/campaigns/components/campaigns-list-nav-sync";
import {
  CAMPAIGNS_TABLE_COLUMNS,
  CampaignsTable,
} from "@/features/campaigns/components/campaigns-table";
import { campaignPortfolioIntel } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  CAMPAIGNS_ADDITIONAL_FILTER_FIELDS,
  CAMPAIGNS_TABLE_FILTER_ACCESSORS,
} from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { CampaignListItem } from "@/types/database";

type CampaignsListViewId = "all" | "blocked" | "finance" | "draft";

const LIST_VIEWS: { id: CampaignsListViewId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blocked", label: "Needs action" },
  { id: "finance", label: "In finance" },
  { id: "draft", label: "No PO" },
];

type CampaignsListSectionProps = {
  campaigns: CampaignListItem[];
  meta: string;
  hasSearch: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

function matchesListView(campaign: CampaignListItem, view: CampaignsListViewId) {
  if (view === "all") return true;
  const intel = campaignPortfolioIntel(campaign);
  if (view === "blocked") {
    return (
      intel.daysWaiting != null ||
      intel.risk === "elevated" ||
      intel.risk === "critical" ||
      intel.businessStateLabel.toLowerCase().includes("attention")
    );
  }
  if (view === "finance") {
    return intel.businessStageLabel.toLowerCase().includes("finance");
  }
  return !(resolveCampaignListPoBudget(campaign) > 0);
}

export function CampaignsListSection({
  campaigns,
  meta,
  hasSearch,
  page,
  pageSize,
  total,
  totalPages,
  search,
  errorSlot,
}: CampaignsListSectionProps) {
  const [view, setView] = useState<CampaignsListViewId>("all");

  const visibleCampaigns = useMemo(
    () => campaigns.filter((campaign) => matchesListView(campaign, view)),
    [campaigns, view]
  );

  const toolbarMeta =
    view === "all"
      ? `${meta} · open a row to enter the workspace`
      : `${visibleCampaigns.length} on this page · ${LIST_VIEWS.find((item) => item.id === view)?.label}`;

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.campaigns}
      columns={CAMPAIGNS_TABLE_COLUMNS}
      rows={visibleCampaigns}
      filterAccessors={CAMPAIGNS_TABLE_FILTER_ACCESSORS}
      additionalFilterFields={CAMPAIGNS_ADDITIONAL_FILTER_FIELDS}
    >
      <CampaignsListNavSync search={search} />

      <div className="tw-c campaigns-module-register">
        <div className="tw-toolbar">
          <Suspense fallback={null}>
            <CampaignsSearch />
          </Suspense>
          <span className="tw-seg" role="group" aria-label="Campaign views">
            {LIST_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </span>
          <OperationalTableControls contextLabel="Campaigns" />
          <span className="tw-sp" />
          <span className="tw-cs">{toolbarMeta}</span>
        </div>

        {errorSlot}

        {visibleCampaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch || view !== "all"} />
        ) : (
          <>
            <CampaignsTable campaigns={visibleCampaigns} />
            <div className="tw-pag">
              <CampaignsPagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                search={search}
              />
            </div>
          </>
        )}
      </div>
    </OperationalTableSuiteProvider>
  );
}
