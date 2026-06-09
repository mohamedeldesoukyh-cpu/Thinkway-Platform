"use client";

import { Suspense, type ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
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
              <OperationalTableToolbar contextLabel="Campaigns">
                <CampaignsSearch />
              </OperationalTableToolbar>
            </Suspense>
          </div>
        }
      >
        {errorSlot}

        {campaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <CampaignsTable campaigns={campaigns} />
            <div className="border-t border-border/40 px-4 py-3 md:px-5">
              <CampaignsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
