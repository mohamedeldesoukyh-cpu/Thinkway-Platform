"use client";

import { Suspense, type ReactNode } from "react";

import "@/app/styles/client-detail-suite.css";

import {
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { ClientsEmptyState } from "@/features/clients/components/clients-empty-state";
import { ClientsPagination } from "@/features/clients/components/clients-pagination";
import { ClientsSearch } from "@/features/clients/components/clients-search";
import { CLIENTS_TABLE_COLUMNS, ClientsTable } from "@/features/clients/components/clients-table";
import type { ClientsListResult } from "@/features/clients/queries";
import { CLIENTS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type ClientsListSectionProps = {
  clients: ClientsListResult["clients"];
  meta: string;
  hasSearch: boolean;
  page: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
  newClientAction?: ReactNode;
};

export function ClientsListSection({
  clients,
  meta,
  hasSearch,
  page,
  totalPages,
  search,
  errorSlot,
  newClientAction,
}: ClientsListSectionProps) {
  return (
    <div className="client-detail-suite">
      <div className="tw-frozen">
        <div className="tw-mast">
          <div className="tw-mh">
            <span className="tw-hmk" aria-hidden>
              <i />
              <u />
            </span>
            <span className="tw-hwd">
              THINK<em>WAY</em>
            </span>
            <span className="tw-hdv" />
            <h1>Clients</h1>
            <span className="sub">
              legal entities · brands and campaigns hang off each one
            </span>
            <span style={{ flex: 1 }} />
            {newClientAction}
          </div>
        </div>
      </div>

      <div className="tw-main">
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.clients}
          columns={CLIENTS_TABLE_COLUMNS}
          rows={clients}
          filterAccessors={CLIENTS_TABLE_FILTER_ACCESSORS}
        >
          <div className="tw-c">
            <div className="tw-ch">
              <span className="tw-ct">All clients</span>
              <span className="tw-cs">{meta}</span>
              <span style={{ flex: 1 }} />
            </div>
            <PlatformV6Toolbar>
              <Suspense fallback={null}>
                <OperationalTableToolbar contextLabel="Clients">
                  <ClientsSearch />
                </OperationalTableToolbar>
              </Suspense>
            </PlatformV6Toolbar>

            <PlatformV6SectionWrap>
              {errorSlot}

              {clients.length === 0 ? (
                <ClientsEmptyState hasSearch={hasSearch} />
              ) : (
                <>
                  <ClientsTable clients={clients} />
                  <div className="border-t border-[var(--tw-hair,#EDF0F5)] px-4 py-3 md:px-[14px]">
                    <ClientsPagination
                      page={page}
                      totalPages={totalPages}
                      search={search}
                    />
                  </div>
                </>
              )}
            </PlatformV6SectionWrap>
          </div>
        </OperationalTableSuiteProvider>
      </div>
    </div>
  );
}
