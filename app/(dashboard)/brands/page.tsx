import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BrandsListSection } from "@/features/brands/components/brands-list-section";
import { NewBrandDialog } from "@/features/brands/components/new-brand-dialog";
import { getBrandsList } from "@/features/brands/queries";
import { getClientsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";

type BrandsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";

  let list;
  let clients: Awaited<ReturnType<typeof getClientsForSelect>> = [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let errorMessage: string | null = null;

  try {
    const [listResult, clientsResult, masterDataResult] = await Promise.all([
      getBrandsList({ page, search }),
      getClientsForSelect(),
      getMasterDataOptions(),
    ]);
    list = listResult;
    clients = clientsResult;
    masterData = masterDataResult;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load brands.";
    list = {
      brands: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
    masterData = {
      categories: [],
      subcategories: [],
      currencies: [],
      countries: [],
      teams: [],
      reportTypes: [],
      paymentTerms: [],
      vrRates: [],
    };
  }

  const { brands, total, totalPages } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1
      ? "1 brand"
      : `${total} brands` + (hasSearch ? ` matching "${search}"` : "");

  const activeClients = clients;

  return (
    <DashboardShell
      title="Brands"
      description="Commercial brands linked to clients. Campaigns are created brand-first from this hierarchy."
      actions={
        masterData ? (
          <NewBrandDialog clients={activeClients} masterData={masterData} />
        ) : null
      }
    >
      <BrandsListSection
        brands={brands}
        meta={meta}
        hasSearch={hasSearch}
        hasClients={activeClients.length > 0}
        page={list.page}
        totalPages={totalPages}
        search={search}
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
