import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { AddFromDiscoveryToCrmDialog } from "@/features/vendors/components/new-commercial-creator-dialog";
import { NewVendorDialog } from "@/features/vendors/components/new-vendor-dialog";
import { VendorsListSection } from "@/features/vendors/components/vendors-list-section";
import { getVendorsList } from "@/features/vendors/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";
import type { InfluencerStatus } from "@/types/database";

type VendorsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    platform?: string;
    /** `all` = legacy full identity inventory (filter off for this view). */
    inventory?: string;
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
  const showAllInventory = params.inventory === "all";

  let list;
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [listResult, masterDataResult] = await Promise.allSettled([
      getVendorsList({
        page,
        search,
        status: status || undefined,
        platform: platform || undefined,
        crmOnly: showAllInventory ? false : undefined,
      }),
      getMasterDataOptions(),
    ]);

    if (listResult.status === "fulfilled") {
      list = listResult.value;
    } else {
      throw listResult.reason;
    }

    if (masterDataResult.status === "fulfilled") {
      currencyOptions = buildCurrencyOptions(masterDataResult.value.currencies);
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendors.";
    list = {
      vendors: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      crmOnly: !showAllInventory,
    };
  }

  const { vendors, total, totalPages, crmOnly } = list;
  const hasFilters = Boolean(search || status || platform);
  const meta =
    (total === 1 ? "1 creator" : `${total} creators`) +
    (crmOnly ? " in Commercial CRM" : " (full identity inventory)") +
    (hasFilters ? " matching filters" : "");

  return (
    <DashboardShell title="Commercial CRM" platformV6>
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Commercial CRM"
          description={
            crmOnly
              ? "Creators with an active commercial relationship — Discovery stays separate until converted."
              : "Full identity inventory (Commercial CRM filter temporarily off)."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AddFromDiscoveryToCrmDialog />
              <NewVendorDialog currencyOptions={currencyOptions} />
            </div>
          }
        />

        <VendorsListSection
          vendors={vendors}
          meta={meta}
          hasFilters={hasFilters}
          page={list.page}
          totalPages={totalPages}
          search={search}
          status={status || undefined}
          platform={platform || undefined}
          crmOnly={crmOnly}
          errorSlot={
            errorMessage ? (
              <div className="border-b px-4 py-3">
                <PageAlert>{errorMessage}</PageAlert>
              </div>
            ) : null
          }
        />
      </PlatformV6Page>
    </DashboardShell>
  );
}
