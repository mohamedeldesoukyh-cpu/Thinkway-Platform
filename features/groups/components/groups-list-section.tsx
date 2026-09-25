"use client";

import type { ReactNode } from "react";
import { BillingCardHeader } from "@/features/billing/components/billing-card-header";

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
          <BillingCardHeader title="Holding Groups" subtitle={meta} actions={<OperationalTableToolbar contextLabel="Groups" />} />
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
