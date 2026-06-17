"use client";

import type { ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { GROUPS_TABLE_COLUMNS, GroupsTable } from "@/features/groups/components/groups-table";
import type { getGroupsList } from "@/features/groups/queries";
import { GROUPS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type GroupsListSectionProps = {
  groups: Awaited<ReturnType<typeof getGroupsList>>["groups"];
  meta: string;
  errorSlot?: ReactNode;
};

export function GroupsListSection({ groups, meta, errorSlot }: GroupsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.groups}
      columns={GROUPS_TABLE_COLUMNS}
      rows={groups}
      filterAccessors={GROUPS_TABLE_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                All groups
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta}</p>
            </div>
            <OperationalTableToolbar contextLabel="Groups" />
          </div>
        }
      >
        {errorSlot}

        {groups.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No groups yet. Create a group, then link clients from the group workspace or
            Clients page.
          </p>
        ) : (
          <GroupsTable groups={groups} />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
