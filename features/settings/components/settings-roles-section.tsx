"use client";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ROLES_TABLE_COLUMN_METAS,
  RolesTable,
} from "@/features/settings/components/roles-table";
import type { SettingsRoleRow } from "@/features/settings/types";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { ROLES_TABLE_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type SettingsRolesSectionProps = {
  roles: SettingsRoleRow[];
};

export function SettingsRolesSection({ roles }: SettingsRolesSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.settingsRoles}
      columns={operationalColumnsFromMetas(ROLES_TABLE_COLUMN_METAS, ROLES_TABLE_FILTER_ACCESSORS)}
      rows={roles}
      filterAccessors={ROLES_TABLE_FILTER_ACCESSORS}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Roles</CardTitle>
          <OperationalTableControlsSlot contextLabel="Roles" />
        </CardHeader>
        <CardContent>
          <RolesTable roles={roles} />
        </CardContent>
      </Card>
    </OperationalTableSuiteProvider>
  );
}
