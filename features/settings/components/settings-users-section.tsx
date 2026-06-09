"use client";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  USERS_TABLE_COLUMN_METAS,
  UsersTable,
} from "@/features/settings/components/users-table";
import type { SettingsRoleRow, SettingsUserRow } from "@/features/settings/types";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { USERS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type SettingsUsersSectionProps = {
  users: SettingsUserRow[];
  roles: SettingsRoleRow[];
};

export function SettingsUsersSection({ users, roles }: SettingsUsersSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.settingsUsers}
      columns={operationalColumnsFromMetas(USERS_TABLE_COLUMN_METAS, USERS_TABLE_FILTER_ACCESSORS)}
      rows={users}
      filterAccessors={USERS_TABLE_FILTER_ACCESSORS}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>User management</CardTitle>
          <OperationalTableControlsSlot contextLabel="Users" />
        </CardHeader>
        <CardContent>
          <UsersTable users={users} roles={roles} />
        </CardContent>
      </Card>
    </OperationalTableSuiteProvider>
  );
}
