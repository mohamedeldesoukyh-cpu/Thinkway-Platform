"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createRoleAction, duplicateRoleAction } from "@/features/settings/actions";
import type { SettingsRoleRow } from "@/features/settings/types";
import Link from "next/link";

const INITIAL = { ok: false } as const;

export function RolesTable({ roles }: { roles: SettingsRoleRow[] }) {
  const [createState, createAction, createPending] = useActionState(createRoleAction, INITIAL);
  const [duplicateState, duplicateAction, duplicatePending] = useActionState(duplicateRoleAction, INITIAL);
  const [selectedRole, setSelectedRole] = useState<string>("");

  useEffect(() => {
    if (!createState.message) return;
    createState.ok ? toast.success(createState.message) : toast.error(createState.message);
  }, [createState]);

  useEffect(() => {
    if (!duplicateState.message) return;
    duplicateState.ok ? toast.success(duplicateState.message) : toast.error(duplicateState.message);
  }, [duplicateState]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button>Create role</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Create role</SheetTitle></SheetHeader>
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>User count</TableHead>
              <TableHead>Permission count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>{role.description ?? "—"}</TableCell>
                <TableCell>{role.user_count}</TableCell>
                <TableCell>{role.permission_count}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/settings/access-control?role=${role.id}`}>Edit role</Link>
                    </Button>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setSelectedRole(role.id)}>
                          Duplicate
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader><SheetTitle>Duplicate role</SheetTitle></SheetHeader>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
