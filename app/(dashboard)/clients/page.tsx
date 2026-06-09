import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientsListSection } from "@/features/clients/components/clients-list-section";
import { NewClientDialog } from "@/features/clients/components/new-client-dialog";
import { getClientsList } from "@/features/clients/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getGroupsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";

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
  let groups: Awaited<ReturnType<typeof getGroupsForSelect>> = [];
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [listResult, groupsResult, masterData] = await Promise.all([
      getClientsList({ page, search }),
      getGroupsForSelect(),
      getMasterDataOptions(),
    ]);
    list = listResult;
    groups = groupsResult;
    currencyOptions = buildCurrencyOptions(masterData.currencies);
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
  const meta =
    total === 1
      ? "1 entity"
      : `${total} entities` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell
      title="Clients"
      description="Legal entities within groups. Brands and campaigns hang off each entity."
      actions={<NewClientDialog groups={groups} currencyOptions={currencyOptions} />}
    >
      <ClientsListSection
        clients={clients}
        meta={meta}
        hasSearch={hasSearch}
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
