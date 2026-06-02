"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleUserStatusAction, updateUserRoleAction } from "@/features/settings/actions";
import { UserStatusBadge } from "@/features/settings/components/user-status-badge";
import type { SettingsRoleRow, SettingsUserRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

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
  const [statusState, statusAction, statusPending] = useActionState(toggleUserStatusAction, INITIAL);

  useEffect(() => {
    if (!roleState.message) return;
    roleState.ok ? toast.success(roleState.message) : toast.error(roleState.message);
  }, [roleState]);

  useEffect(() => {
    if (!statusState.message) return;
    statusState.ok ? toast.success(statusState.message) : toast.error(statusState.message);
  }, [statusState]);

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  if (!users.length) {
    return <p className="text-sm text-muted-foreground">No users found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead>Portal type</TableHead>
            <TableHead>Access level</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name ?? "—"}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role ?? "—"}</TableCell>
              <TableCell>{user.department ?? "—"}</TableCell>
              <TableCell>{user.country ?? "—"}</TableCell>
              <TableCell><UserStatusBadge status={user.status} /></TableCell>
              <TableCell>
                {user.last_login ? new Date(user.last_login).toLocaleString() : "—"}
              </TableCell>
              <TableCell className="capitalize">{user.portal_type}</TableCell>
              <TableCell>{user.access_level ?? "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button size="sm" variant="outline">Edit role</Button>
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
                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
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
                              rolePending ||
                              !(selectedProfile === user.id && roleMap.has(selectedRole))
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
