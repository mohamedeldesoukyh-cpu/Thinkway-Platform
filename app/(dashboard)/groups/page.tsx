import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
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
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : result ? (
        <div className="rounded-3xl border border-border">
          <Table>
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
                  <TableCell className="font-mono text-xs">
                    {group.document_number}
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {group.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.groups.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No groups yet.{" "}
              <Link href="/clients" className="underline">
                Add legal entities
              </Link>{" "}
              under a group to build your hierarchy.
            </p>
          ) : null}
        </div>
      ) : null}
    </DashboardShell>
  );
}
