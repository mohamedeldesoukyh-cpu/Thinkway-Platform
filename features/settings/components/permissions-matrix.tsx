"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SETTINGS_MODULES } from "@/features/settings/constants";
import type { RolePermissionMatrix } from "@/features/settings/types";

function hasAny(permissions: string[], required: string[]) {
  return required.some((p) => permissions.includes(p));
}

function mark(value: boolean) {
  return value ? "✓" : "✗";
}

export function PermissionsMatrix({ matrix }: { matrix: RolePermissionMatrix[] }) {
  return (
    <div className="space-y-4">
      {matrix.map((role) => (
        <Card key={role.role_id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {role.role_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Write</TableHead>
                    <TableHead>Approve</TableHead>
                    <TableHead>Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SETTINGS_MODULES.map((module) => (
                    <TableRow key={`${role.role_id}-${module.key}`}>
                      <TableCell>{module.label}</TableCell>
                      <TableCell>{mark(hasAny(role.permissions, module.permissions.filter((p) => p.endsWith(".read"))))}</TableCell>
                      <TableCell>{mark(hasAny(role.permissions, module.permissions.filter((p) => p.endsWith(".write"))))}</TableCell>
                      <TableCell>{mark(hasAny(role.permissions, module.permissions.filter((p) => p.endsWith(".approve"))))}</TableCell>
                      <TableCell>{mark(hasAny(role.permissions, module.permissions.filter((p) => p.endsWith(".delete"))))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
