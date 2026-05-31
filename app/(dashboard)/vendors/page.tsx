import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NewVendorDialog } from "@/features/vendors/components/new-vendor-dialog";
import { VendorsEmptyState } from "@/features/vendors/components/vendors-empty-state";
import { VendorsFilters } from "@/features/vendors/components/vendors-filters";
import { VendorsPagination } from "@/features/vendors/components/vendors-pagination";
import { VendorsSearch } from "@/features/vendors/components/vendors-search";
import { VendorsTable } from "@/features/vendors/components/vendors-table";
import { getVendorsList } from "@/features/vendors/queries";
import type { InfluencerStatus } from "@/types/database";

type VendorsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    platform?: string;
  }>;
};

const VALID_STATUSES: InfluencerStatus[] = [
  "prospect",
  "active",
  "inactive",
  "blacklisted",
];

function parseStatus(value: string | undefined): InfluencerStatus | "" {
  if (!value) {
    return "";
  }

  return VALID_STATUSES.includes(value as InfluencerStatus)
    ? (value as InfluencerStatus)
    : "";
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";
  const status = parseStatus(params.status);
  const platform = params.platform?.trim() ?? "";

  let list;
  let errorMessage: string | null = null;

  try {
    list = await getVendorsList({
      page,
      search,
      status: status || undefined,
      platform: platform || undefined,
    });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendors.";
    list = {
      vendors: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
  }

  const { vendors, total, totalPages } = list;
  const hasFilters = Boolean(search || status || platform);

  return (
    <DashboardShell
      title="Vendors"
      description="Manage creators, agencies, and platform presence for campaign assignments."
      actions={<NewVendorDialog />}
    >
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="space-y-1">
            <CardTitle>All vendors</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total === 1 ? "1 vendor" : `${total} vendors`}
              {hasFilters ? " matching filters" : ""}
            </p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Suspense fallback={null}>
              <VendorsSearch />
            </Suspense>
            <Suspense fallback={null}>
              <VendorsFilters />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {vendors.length === 0 ? (
            <VendorsEmptyState hasFilters={hasFilters} />
          ) : (
            <>
              <VendorsTable vendors={vendors} />
              <VendorsPagination
                page={list.page}
                totalPages={totalPages}
                search={search}
                status={status || undefined}
                platform={platform || undefined}
              />
            </>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
