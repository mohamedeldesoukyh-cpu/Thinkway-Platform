import { BillingStyleShell } from "@/components/finance/billing-style-shell";
import { BillingStyleKpis } from "@/components/finance/billing-style-surfaces";
import { PageAlert } from "@/components/ui/page-alert";
import { GroupsListSection } from "@/features/groups/components/groups-list-section";
import { NewGroupDialog } from "@/features/groups/components/new-group-dialog";
import { getGroupsList } from "@/features/groups/queries";
import { getUnlinkedClientsForSelect } from "@/lib/master-data/queries";

type GroupsPageProps = {
  searchParams: Promise<{ page?: string; search?: string }>;
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";

  let result;
  let unlinkedClients: Awaited<ReturnType<typeof getUnlinkedClientsForSelect>> = [];
  let errorMessage: string | null = null;

  try {
    [result, unlinkedClients] = await Promise.all([
      getGroupsList({ page, search }),
      getUnlinkedClientsForSelect(),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load groups.";
  }

  const meta = result
    ? result.total === 1
      ? "1 group"
      : `${result.total} groups`
    : "";

  return (
    <BillingStyleShell
      title="Holding Groups"
      description="Top-level holding groups. Link clients from the group workspace."
      actions={<NewGroupDialog unlinkedClients={unlinkedClients} />}
    >
      {errorMessage ? <PageAlert className="mb-4">{errorMessage}</PageAlert> : null}
      {result && <BillingStyleKpis items={[
        { id: "total", label: "Holding Groups", value: String(result.total), hint: search ? "Matching your search" : "All holding groups" },
        { id: "active", label: "Active groups", value: String(result.groups.filter(group => group.status?.toLowerCase() === "active").length), hint: "On this page" },
        { id: "clients", label: "Clients without a group", value: String(unlinkedClients.length), hint: "Available to link to a holding group" },
      ]} />}
      {result ? <GroupsListSection groups={result.groups} meta={meta} /> : null}
    </BillingStyleShell>
  );
}
