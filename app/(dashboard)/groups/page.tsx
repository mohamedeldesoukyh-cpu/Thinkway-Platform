import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageAlert } from "@/components/ui/page-alert";
import { GroupsListSection } from "@/features/groups/components/groups-list-section";
import { NewGroupDialog } from "@/features/groups/components/new-group-dialog";
import { getGroupsList } from "@/features/groups/queries";

type GroupsPageProps = {
  searchParams: Promise<{ page?: string; search?: string }>;
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";

  let result;
  let errorMessage: string | null = null;

  try {
    result = await getGroupsList({ page, search });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load groups.";
  }

  const meta = result
    ? result.total === 1
      ? "1 group"
      : `${result.total} groups`
    : "";

  return (
    <DashboardShell
      title="Groups"
      description="Top-level holding groups. Link clients from the group workspace."
      actions={<NewGroupDialog />}
    >
      {errorMessage ? <PageAlert className="mb-4">{errorMessage}</PageAlert> : null}
      {result ? <GroupsListSection groups={result.groups} meta={meta} /> : null}
    </DashboardShell>
  );
}
