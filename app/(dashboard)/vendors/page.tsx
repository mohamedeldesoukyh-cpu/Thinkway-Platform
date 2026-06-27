import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
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
  let currencyOptions: { value: string; label: string }[] = [];
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

  try {
    const masterData = await getMasterDataOptions();
    currencyOptions = buildCurrencyOptions(masterData.currencies);
  } catch {
    currencyOptions = [];
  }

  const { vendors, total, totalPages } = list;
  const hasFilters = Boolean(search || status || platform);
  const meta =
    total === 1 ? "1 vendor" : `${total} vendors` + (hasFilters ? " matching filters" : "");

  return (
    <DashboardShell title="Vendors" platformV6>
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Vendors"
          description="Manage creators, agencies, and platform presence for campaign assignments."
          actions={<NewVendorDialog currencyOptions={currencyOptions} />}
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
