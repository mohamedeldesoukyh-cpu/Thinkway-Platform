"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
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
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

export function CampaignsListSection({
  campaigns,
  meta,
  hasSearch,
  page,
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
      <PlatformV6SectionMeta title="All campaigns" meta={meta} />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Campaigns">
            <CampaignsSearch />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {campaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <CampaignsTable campaigns={campaigns} />
            <div className="border-t px-4 py-3 md:px-[14px]">
              <CampaignsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}
