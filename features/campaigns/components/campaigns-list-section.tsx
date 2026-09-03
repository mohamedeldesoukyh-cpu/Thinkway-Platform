"use client";

import { Suspense, type ReactNode } from "react";

import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
import { CampaignsListNavSync } from "@/features/campaigns/components/campaigns-list-nav-sync";
import {
  CAMPAIGNS_TABLE_COLUMNS,
  CampaignsTable,
} from "@/features/campaigns/components/campaigns-table";
import {
  CAMPAIGNS_ADDITIONAL_FILTER_FIELDS,
  CAMPAIGNS_TABLE_FILTER_ACCESSORS,
} from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { CampaignListItem } from "@/types/database";

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
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.campaigns}
      columns={CAMPAIGNS_TABLE_COLUMNS}
      rows={campaigns}
      filterAccessors={CAMPAIGNS_TABLE_FILTER_ACCESSORS}
      additionalFilterFields={CAMPAIGNS_ADDITIONAL_FILTER_FIELDS}
    >
      <CampaignsListNavSync search={search} />

      <div className="tw-c campaigns-module-register">
        <div className="tw-toolbar">
          <Suspense fallback={null}>
            <OperationalTableToolbar contextLabel="Campaigns">
              <CampaignsSearch />
            </OperationalTableToolbar>
          </Suspense>
          <span className="tw-sp" />
          <span className="tw-cs">{meta} · open a row to enter the workspace</span>
        </div>

        {errorSlot}

        {campaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <CampaignsTable campaigns={campaigns} />
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
