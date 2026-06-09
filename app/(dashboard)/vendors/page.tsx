import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
    const [listResult, masterData] = await Promise.all([
      getVendorsList({
        page,
        search,
        status: status || undefined,
        platform: platform || undefined,
      }),
      getMasterDataOptions(),
    ]);
    list = listResult;
    currencyOptions = buildCurrencyOptions(masterData.currencies);
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
  const meta =
    total === 1 ? "1 vendor" : `${total} vendors` + (hasFilters ? " matching filters" : "");

  return (
    <DashboardShell
      title="Vendors"
      description="Manage creators, agencies, and platform presence for campaign assignments."
      actions={<NewVendorDialog currencyOptions={currencyOptions} />}
    >
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
            <div className="border-b border-border/40 px-4 py-3">
              <PageAlert>{errorMessage}</PageAlert>
            </div>
          ) : null
        }
      />
    </DashboardShell>
  );
}
