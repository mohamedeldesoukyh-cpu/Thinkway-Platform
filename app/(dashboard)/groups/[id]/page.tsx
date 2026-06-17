import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GroupWorkspaceView } from "@/features/groups/components/group-workspace";
import {
  getAccountDirectorsForSelect,
  getGroupWorkspace,
} from "@/features/groups/queries";
import { getMasterDataOptions, getUnlinkedClientsForSelect } from "@/lib/master-data/queries";

type GroupWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupWorkspacePage({
  params,
}: GroupWorkspacePageProps) {
  const { id } = await params;

  let workspace;
  let accountDirectors: Awaited<ReturnType<typeof getAccountDirectorsForSelect>> =
    [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let unlinkedClients: Awaited<ReturnType<typeof getUnlinkedClientsForSelect>> = [];
  let errorMessage: string | null = null;

  try {
    [workspace, accountDirectors, masterData, unlinkedClients] = await Promise.all([
      getGroupWorkspace(id),
      getAccountDirectorsForSelect(),
      getMasterDataOptions(),
      getUnlinkedClientsForSelect(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load group workspace.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Group workspace"
      description="Operational profile for group portfolio, clients, brands, and finance."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : workspace && masterData ? (
        <GroupWorkspaceView
          workspace={workspace}
          accountDirectors={accountDirectors}
          masterData={masterData}
          unlinkedClients={unlinkedClients}
        />
      ) : null}
    </DashboardShell>
  );
}
