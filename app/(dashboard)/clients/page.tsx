import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientsEmptyState } from "@/features/clients/components/clients-empty-state";
import { ClientsPagination } from "@/features/clients/components/clients-pagination";
import { ClientsSearch } from "@/features/clients/components/clients-search";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { NewClientDialog } from "@/features/clients/components/new-client-dialog";
import { getClientsList } from "@/features/clients/queries";

type ClientsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";

  let list;
  let errorMessage: string | null = null;

  try {
    list = await getClientsList({ page, search });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load clients.";
    list = {
      clients: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
  }

  const { clients, total, totalPages } = list;
  const hasSearch = Boolean(search);

  return (
    <DashboardShell
      title="Clients"
      description="Manage brand accounts, billing details, and client relationships."
      actions={<NewClientDialog />}
    >
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>All clients</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total === 1 ? "1 client" : `${total} clients`}
              {hasSearch ? ` matching "${search}"` : ""}
            </p>
          </div>
          <Suspense fallback={null}>
            <ClientsSearch />
          </Suspense>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {clients.length === 0 ? (
            <ClientsEmptyState hasSearch={hasSearch} />
          ) : (
            <>
              <ClientsTable clients={clients} />
              <ClientsPagination
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
