"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  removeClientUserAction,
  setPrimaryClientUserAction,
} from "@/features/client-access/actions";
import { AssignClientUserSheet } from "@/features/client-access/components/assign-client-user-sheet";
import { ClientAccessRoleSelect } from "@/features/client-access/components/client-access-role-select";
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";

const INITIAL = { ok: false } as const;

type Props = {
  entity: ClientAccessEntityRow;
  assignable: AssignableClientProfileRow[];
  compact?: boolean;
};

export function ClientAccessWorkspace({ entity, assignable, compact }: Props) {
  const [removeState, removeAction, removePending] = useActionState(
    removeClientUserAction,
    INITIAL
  );
  const [primaryState, primaryAction, primaryPending] = useActionState(
    setPrimaryClientUserAction,
    INITIAL
  );

  useEffect(() => {
    if (removeState.message) {
      if (removeState.ok) toast.success(removeState.message);
      else toast.error(removeState.message);
    }
  }, [removeState]);

  useEffect(() => {
    if (primaryState.message) {
      if (primaryState.ok) toast.success(primaryState.message);
      else toast.error(primaryState.message);
    }
  }, [primaryState]);

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-semibold">{entity.client_name}</h3>
            <p className="font-mono text-sm text-muted-foreground">
              {entity.document_number}
            </p>
          </div>
          <AssignClientUserSheet
            clientId={entity.client_id}
            clientName={entity.client_name}
            assignable={assignable}
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <AssignClientUserSheet
            clientId={entity.client_id}
            clientName={entity.client_name}
            assignable={assignable}
          />
        </div>
      )}

      {entity.users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No client portal users assigned to this legal entity.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Primary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entity.users.map((user) => (
              <TableRow key={user.profile_id}>
                <TableCell className="font-medium">
                  {user.full_name ?? "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <ClientAccessRoleSelect
                    clientId={entity.client_id}
                    profileId={user.profile_id}
                    currentRole={user.access_role}
                  />
                </TableCell>
                <TableCell>
                  {user.is_primary ? (
                    <Badge variant="secondary">Primary</Badge>
                  ) : (
                    <form action={primaryAction}>
                      <input type="hidden" name="client_id" value={entity.client_id} />
                      <input type="hidden" name="profile_id" value={user.profile_id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={primaryPending}
                      >
                        Set primary
                      </Button>
                    </form>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <form action={removeAction}>
                    <input type="hidden" name="client_id" value={entity.client_id} />
                    <input type="hidden" name="profile_id" value={user.profile_id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={removePending}
                    >
                      Remove
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
