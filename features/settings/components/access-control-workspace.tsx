"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { updateRolePermissionsAction } from "@/features/settings/actions";
import { SETTINGS_MODULES } from "@/features/settings/constants";
import type { RolePermissionMatrix, SettingsPermissionRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

export function AccessControlWorkspace({
  matrix,
  permissions,
  selectedRoleId,
}: {
  matrix: RolePermissionMatrix[];
  permissions: SettingsPermissionRow[];
  selectedRoleId?: string | null;
}) {
  const [roleId, setRoleId] = useState(selectedRoleId ?? matrix[0]?.role_id ?? "");
  const [permissionCsv, setPermissionCsv] = useState("");
  const [state, action, pending] = useActionState(updateRolePermissionsAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    state.ok ? toast.success(state.message) : toast.error(state.message);
  }, [state]);

  const selected = useMemo(
    () => matrix.find((m) => m.role_id === roleId) ?? matrix[0] ?? null,
    [matrix, roleId]
  );

  const availableBySlug = useMemo(
    () => new Set(permissions.map((p) => p.slug)),
    [permissions]
  );

  const selectedSet = useMemo(
    () => new Set(selected?.permissions ?? []),
    [selected]
  );

  const defaultPermissionCsv = useMemo(
    () => [...selectedSet].join(","),
    [selectedSet]
  );

  useEffect(() => {
    setPermissionCsv(defaultPermissionCsv);
  }, [defaultPermissionCsv]);

  if (!selected) {
    return <p className="text-sm text-muted-foreground">No role data available.</p>;
  }

  return (
    <OperationalFormSection
      title="Access Control"
      description="Lightweight module visibility and page access controls. No enterprise policy engine."
      footer={
        <Button type="submit" form="access-control-form" disabled={pending}>
          {pending ? "Saving..." : "Apply access control"}
        </Button>
      }
    >
      <div className="max-w-sm grid gap-2">
        <Label>Role</Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
          <SelectContent>
            {matrix.map((role) => (
              <SelectItem key={role.role_id} value={role.role_id}>
                {role.role_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form id="access-control-form" action={action} className="space-y-4">
        <input type="hidden" name="role_id" value={selected.role_id} />
        <input type="hidden" name="permission_slugs" value={permissionCsv} />

        <div className="grid gap-3">
          {SETTINGS_MODULES.map((module) => {
            const read = module.permissions.find((p) => p.endsWith(".read"));
            const write = module.permissions.find((p) => p.endsWith(".write"));
            const approve = module.permissions.find((p) => p.endsWith(".approve"));
            const del = module.permissions.find((p) => p.endsWith(".delete"));
            return (
              <div key={module.key} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">{module.label}</p>
                <p className="text-muted-foreground">
                  Read {read && availableBySlug.has(read) ? (selectedSet.has(read) ? "✓" : "✗") : "—"} ·
                  Write {write && availableBySlug.has(write) ? (selectedSet.has(write) ? "✓" : "✗") : "—"} ·
                  Approve {approve && availableBySlug.has(approve) ? (selectedSet.has(approve) ? "✓" : "✗") : "—"} ·
                  Delete {del && availableBySlug.has(del) ? (selectedSet.has(del) ? "✓" : "✗") : "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {module.permissions
                    .filter((p) => availableBySlug.has(p))
                    .map((slug) => {
                      const enabled = permissionCsv.split(",").includes(slug);
                      return (
                        <button
                          key={slug}
                          type="button"
                          className={`rounded-full border px-2 py-1 text-xs ${enabled ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground"}`}
                          onClick={() => {
                            const set = new Set(
                              permissionCsv
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                            );
                            if (set.has(slug)) set.delete(slug);
                            else set.add(slug);
                            setPermissionCsv([...set].join(","));
                          }}
                        >
                          {enabled ? "✓" : "✗"} {slug}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </OperationalFormSection>
  );
}
