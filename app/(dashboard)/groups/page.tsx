import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { DataPanel, DataPanelContent, DataPanelHeader } from "@/components/ui/data-panel";
import { PageAlert } from "@/components/ui/page-alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <DashboardShell
      title="Groups"
      description="Top-level holding groups containing legal entities and brands."
      actions={<NewGroupDialog />}
    >
      {errorMessage ? <PageAlert className="mb-4">{errorMessage}</PageAlert> : null}
      {result ? (
        <DataPanel>
          <DataPanelHeader
            title="All groups"
            meta={`${result.total === 1 ? "1 group" : `${result.total} groups`}`}
          />
          <DataPanelContent flush className="[&_[data-slot=table-container]]:rounded-none">
          <Table variant="flush">
            <TableHeader>
              <TableRow>
                <TableHead>Group #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="text-xs">
                    <Link
                      href={`/groups/${group.id}`}
                      className="hover:underline"
                    >
                      <DocumentNumber value={group.document_number} showCanonicalTitle={false} />
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/groups/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-success/40 bg-success/10 font-medium text-success capitalize"
                    >
                      {group.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.groups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No groups yet.{" "}
              <Link href="/clients" className="underline">
                Add legal entities
              </Link>{" "}
              under a group to build your hierarchy.
            </p>
          ) : null}
          </DataPanelContent>
        </DataPanel>
      ) : null}
    </DashboardShell>
  );
}
