import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GroupWorkspaceView } from "@/features/groups/components/group-workspace";
import {
  getAccountDirectorsForSelect,
  getGroupWorkspace,
} from "@/features/groups/queries";
import { getMasterDataOptions, getUnlinkedClientsForSelect } from "@/lib/master-data/queries";
import { groupDetailPath } from "@/lib/routing/entity-paths";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchGroupRouteSummary,
  resolveGroupIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

type GroupWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: Pick<GroupWorkspacePageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const groupId = await resolveGroupIdByRouteKey(routeKey);
  if (!groupId) return { title: "Group" };

  const summary = await fetchGroupRouteSummary(groupId);
  if (!summary) return { title: "Group" };

  return {
    title: metadataTitleForEntity(summary, summary.document_number),
  };
}

export default async function GroupWorkspacePage({
  params,
}: GroupWorkspacePageProps) {
  const { id: routeKey } = await params;

  const groupId = await resolveGroupIdByRouteKey(routeKey);
  if (!groupId) notFound();

  const routeSummary = await fetchGroupRouteSummary(groupId);
  if (routeSummary) {
    redirectToCanonicalEntityRoute({
      routeKey,
      entity: routeSummary,
      canonicalPath: groupDetailPath(routeSummary),
    });
  }

  let workspace;
  let accountDirectors: Awaited<ReturnType<typeof getAccountDirectorsForSelect>> =
    [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let unlinkedClients: Awaited<ReturnType<typeof getUnlinkedClientsForSelect>> = [];
  let errorMessage: string | null = null;

  try {
    [workspace, accountDirectors, masterData, unlinkedClients] = await Promise.all([
      getGroupWorkspace(groupId),
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
      title={workspace?.name ?? "Group workspace"}
      hidePageHeader
      platformV6
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
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
