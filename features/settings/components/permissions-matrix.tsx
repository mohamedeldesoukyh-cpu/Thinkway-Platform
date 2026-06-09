"use client";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { SETTINGS_MODULES } from "@/features/settings/constants";
import type { RolePermissionMatrix } from "@/features/settings/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { permissionsMatrixFilterAccessors } from "@/lib/tables/workspace-table-filter-fields";

function hasAny(permissions: string[], required: string[]) {
  return required.some((p) => permissions.includes(p));
}

function mark(value: boolean) {
  return value ? "✓" : "✗";
}

type ModuleRow = (typeof SETTINGS_MODULES)[number];

function buildPermissionsMatrixColumns(
  permissions: string[]
): OperationalConfigurableColumnDef<ModuleRow>[] {
  return [
    {
      id: "module",
      label: "Module",
      renderCell: (module) => module.label,
    },
    {
      id: "read",
      label: "Read",
      renderCell: (module) =>
        mark(
          hasAny(
            permissions,
            module.permissions.filter((p) => p.endsWith(".read"))
          )
        ),
    },
    {
      id: "write",
      label: "Write",
      renderCell: (module) =>
        mark(
          hasAny(
            permissions,
            module.permissions.filter((p) => p.endsWith(".write"))
          )
        ),
    },
    {
      id: "approve",
      label: "Approve",
      renderCell: (module) =>
        mark(
          hasAny(
            permissions,
            module.permissions.filter((p) => p.endsWith(".approve"))
          )
        ),
    },
    {
      id: "delete",
      label: "Delete",
      renderCell: (module) =>
        mark(
          hasAny(
            permissions,
            module.permissions.filter((p) => p.endsWith(".delete"))
          )
        ),
    },
  ];
}

export const PERMISSIONS_MATRIX_COLUMN_METAS = getOperationalTableColumnMetas(
  buildPermissionsMatrixColumns([])
);

export function PermissionsMatrix({ matrix }: { matrix: RolePermissionMatrix[] }) {
  return (
    <div className="space-y-4">
      {matrix.map((role) => (
        <OperationalTableSuiteProvider
          key={role.role_id}
          tableId={`${OPERATIONAL_TABLE_IDS.settingsPermissionsMatrix}-${role.role_id}`}
          columns={buildPermissionsMatrixColumns(role.permissions)}
          rows={SETTINGS_MODULES}
          filterAccessors={permissionsMatrixFilterAccessors(role.permissions)}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {role.role_name}
                </h2>
                <OperationalTableControlsSlot contextLabel={`${role.role_name} permissions`} />
              </div>
            }
          >
            <OperationalConfigurableTable
              columns={buildPermissionsMatrixColumns(role.permissions)}
              rows={SETTINGS_MODULES}
              rowKey={(module) => `${role.role_id}-${module.key}`}
            />
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
      ))}
    </div>
  );
}
