"use client";

import { Suspense, type ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
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
};

export function ClientsListSection({
  clients,
  meta,
  hasSearch,
  page,
  totalPages,
  search,
  errorSlot,
}: ClientsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.clients}
      columns={CLIENTS_TABLE_COLUMNS}
      rows={clients}
      filterAccessors={CLIENTS_TABLE_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                All legal entities
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta}</p>
            </div>
            <Suspense fallback={null}>
              <OperationalTableToolbar contextLabel="Clients">
                <ClientsSearch />
              </OperationalTableToolbar>
            </Suspense>
          </div>
        }
      >
        {errorSlot}

        {clients.length === 0 ? (
          <ClientsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <ClientsTable clients={clients} />
            <div className="border-t border-border/40 px-4 py-3 md:px-5">
              <ClientsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
