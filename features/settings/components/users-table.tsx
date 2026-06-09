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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserStatusBadge } from "@/features/settings/components/user-status-badge";
import { toggleUserStatusAction, updateUserRoleAction } from "@/features/settings/actions";
import type { SettingsRoleRow, SettingsUserRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

function buildUsersColumns(
  roles: SettingsRoleRow[],
  roleMap: Map<string, SettingsRoleRow>,
  selectedRole: string,
  selectedProfile: string,
  setSelectedRole: (value: string) => void,
  setSelectedProfile: (value: string) => void,
  roleAction: (payload: FormData) => void,
  rolePending: boolean,
  statusAction: (payload: FormData) => void,
  statusPending: boolean
): OperationalConfigurableColumnDef<SettingsUserRow>[] {
  return [
    {
      id: "name",
      label: "Name",
      renderCell: (user) => user.name ?? "—",
    },
    {
      id: "email",
      label: "Email",
      renderCell: (user) => user.email,
    },
    {
      id: "role",
      label: "Role",
      renderCell: (user) => user.role ?? "—",
    },
    {
      id: "department",
      label: "Department",
      renderCell: (user) => user.department ?? "—",
    },
    {
      id: "country",
      label: "Country",
      renderCell: (user) => user.country ?? "—",
    },
    {
      id: "status",
      label: "Status",
      renderCell: (user) => <UserStatusBadge status={user.status} />,
    },
    {
      id: "last_login",
      label: "Last login",
      renderCell: (user) =>
        user.last_login ? new Date(user.last_login).toLocaleString() : "—",
    },
    {
      id: "portal_type",
      label: "Portal type",
      cellClassName: "capitalize",
      renderCell: (user) => user.portal_type,
    },
    {
      id: "access_level",
      label: "Access level",
      renderCell: (user) => user.access_level ?? "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (user) => (
        <div className="inline-flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline">
                Edit role
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Edit role</SheetTitle>
              </SheetHeader>
              <form action={roleAction} className="mt-4 grid gap-4">
                <input type="hidden" name="profile_id" value={user.id} />
                <div className="grid gap-2">
                  <Label>User</Label>
                  <Input value={user.email} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select
                    value={selectedProfile === user.id ? selectedRole : ""}
                    onValueChange={(value) => {
                      setSelectedProfile(user.id);
                      setSelectedRole(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="role_id"
                    value={selectedProfile === user.id ? selectedRole : ""}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      rolePending || !(selectedProfile === user.id && roleMap.has(selectedRole))
                    }
                  >
                    {rolePending ? "Saving..." : "Save role"}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>

          <form action={statusAction}>
            <input type="hidden" name="profile_id" value={user.id} />
            <input
              type="hidden"
              name="next_status"
              value={user.status === "disabled" ? "active" : "disabled"}
            />
            <Button size="sm" variant="outline" type="submit" disabled={statusPending}>
              {user.status === "disabled" ? "Enable" : "Disable"}
            </Button>
          </form>

          <Button size="sm" variant="outline" asChild>
            <Link href={`/settings/permissions?user=${user.id}`}>View permissions</Link>
          </Button>
        </div>
      ),
    },
  ];
}

const USERS_TABLE_COLUMNS = buildUsersColumns(
  [],
  new Map(),
  "",
  "",
  () => {},
  () => {},
  () => {},
  false,
  () => {},
  false
);

export const USERS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(USERS_TABLE_COLUMNS);

export function UsersTable({
  users,
  roles,
}: {
  users: SettingsUserRow[];
  roles: SettingsRoleRow[];
}) {
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [roleState, roleAction, rolePending] = useActionState(updateUserRoleAction, INITIAL);
  const [statusState, statusAction, statusPending] = useActionState(
    toggleUserStatusAction,
    INITIAL
  );

  useEffect(() => {
    if (!roleState.message) return;
    roleState.ok ? toast.success(roleState.message) : toast.error(roleState.message);
  }, [roleState]);

  useEffect(() => {
    if (!statusState.message) return;
    statusState.ok ? toast.success(statusState.message) : toast.error(statusState.message);
  }, [statusState]);

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const columns = useMemo(
    () =>
      buildUsersColumns(
        roles,
        roleMap,
        selectedRole,
        selectedProfile,
        setSelectedRole,
        setSelectedProfile,
        roleAction,
        rolePending,
        statusAction,
        statusPending
      ),
    [
      roles,
      roleMap,
      selectedRole,
      selectedProfile,
      roleAction,
      rolePending,
      statusAction,
      statusPending,
    ]
  );

  if (!users.length) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">No users found.</p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={users}
      rowKey={(user) => user.id}
    />
  );
}
