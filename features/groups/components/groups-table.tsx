"use client";

import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OPERATIONAL_STATUS_PILL_BASE } from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import { Badge } from "@/components/ui/badge";
import type { getGroupsList } from "@/features/groups/queries";
import { cn } from "@/lib/utils";

type GroupsTableProps = {
  groups: Awaited<ReturnType<typeof getGroupsList>>["groups"];
};

type GroupRow = GroupsTableProps["groups"][number];

export const GROUPS_TABLE_COLUMNS: OperationalConfigurableColumnDef<GroupRow>[] = [
  {
    id: "document_number",
    label: "Group #",
    monoCell: true,
    renderCell: (group) => (
      <Link href={`/groups/${group.id}`} className="hover:text-primary hover:underline">
        <DocumentNumber value={group.document_number} showCanonicalTitle={false} />
      </Link>
    ),
  },
  {
    id: "name",
    label: "Name",
    renderCell: (group) => (
      <Link
        href={`/groups/${group.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {group.name}
      </Link>
    ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (group) => (
      <Badge
        variant="outline"
        className={cn(
          OPERATIONAL_STATUS_PILL_BASE,
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        )}
      >
        {group.status}
      </Badge>
    ),
  },
];

export const GROUPS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(GROUPS_TABLE_COLUMNS);

export function GroupsTable({ groups }: GroupsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={GROUPS_TABLE_COLUMNS}
      rows={groups}
      rowKey={(group) => group.id}
    />
  );
}
