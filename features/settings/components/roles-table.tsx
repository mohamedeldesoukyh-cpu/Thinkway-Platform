"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createRoleAction, duplicateRoleAction } from "@/features/settings/actions";
import type { SettingsRoleRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

function buildRolesColumns(
  selectedRole: string,
  setSelectedRole: (value: string) => void,
  duplicateAction: (payload: FormData) => void,
  duplicatePending: boolean
): OperationalConfigurableColumnDef<SettingsRoleRow>[] {
  return [
    {
      id: "role",
      label: "Role",
      cellClassName: "font-medium",
      renderCell: (role) => role.name,
    },
    {
      id: "description",
      label: "Description",
      renderCell: (role) => role.description ?? "—",
    },
    {
      id: "user_count",
      label: "User count",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (role) => role.user_count,
    },
    {
      id: "permission_count",
      label: "Permission count",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (role) => role.permission_count,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (role) => (
        <div className="inline-flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/settings/access-control?role=${role.id}`}>Edit role</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedRole(role.id)}
              >
                Duplicate
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Duplicate role</SheetTitle>
              </SheetHeader>
              <form action={duplicateAction} className="mt-4 grid gap-4">
                <input type="hidden" name="source_role_id" value={selectedRole} />
                <div className="grid gap-2">
                  <Label htmlFor="new_name">New role name</Label>
                  <Input id="new_name" name="new_name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new_slug">New role slug</Label>
                  <Input id="new_slug" name="new_slug" required />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={duplicatePending}>
                    {duplicatePending ? "Duplicating..." : "Duplicate"}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      ),
    },
  ];
}

const ROLES_TABLE_COLUMNS = buildRolesColumns("", () => {}, () => {}, false);

export const ROLES_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(ROLES_TABLE_COLUMNS);

export function RolesTable({ roles }: { roles: SettingsRoleRow[] }) {
  const [createState, createAction, createPending] = useActionState(createRoleAction, INITIAL);
  const [duplicateState, duplicateAction, duplicatePending] = useActionState(
    duplicateRoleAction,
    INITIAL
  );
  const [selectedRole, setSelectedRole] = useState<string>("");

  useEffect(() => {
    if (!createState.message) return;
    createState.ok ? toast.success(createState.message) : toast.error(createState.message);
  }, [createState]);

  useEffect(() => {
    if (!duplicateState.message) return;
    duplicateState.ok
      ? toast.success(duplicateState.message)
      : toast.error(duplicateState.message);
  }, [duplicateState]);

  const columns = useMemo(
    () => buildRolesColumns(selectedRole, setSelectedRole, duplicateAction, duplicatePending),
    [selectedRole, duplicateAction, duplicatePending]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button>Create role</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Create role</SheetTitle>
            </SheetHeader>
            <form action={createAction} className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Role name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" placeholder="custom_role" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {roles.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">No roles configured.</p>
      ) : (
        <OperationalConfigurableTable
          columns={columns}
          rows={roles}
          rowKey={(role) => role.id}
        />
      )}
    </div>
  );
}
