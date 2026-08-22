"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EntityLogoField } from "@/features/entity-logos/components/entity-logo-field";
import {
  updateGroupAction,
  type FormActionState,
} from "@/features/groups/actions";
import { checkGroupNameAvailable } from "@/features/validation/actions";
import {
  GROUP_REGION_OPTIONS,
  type GroupWorkspace,
} from "@/features/groups/types";
import type { ClientStatus } from "@/types/database";

type GroupEditSheetProps = {
  workspace: GroupWorkspace;
  accountDirectors: { id: string; full_name: string | null; email: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GroupEditSheet({
  workspace,
  accountDirectors,
  open,
  onOpenChange,
}: GroupEditSheetProps) {
  const [status, setStatus] = useState<ClientStatus>(workspace.status);
  const [groupName, setGroupName] = useState(workspace.name);
  const [region, setRegion] = useState(workspace.region ?? "");
  const [accountDirectorId, setAccountDirectorId] = useState(
    workspace.account_director?.id ?? ""
  );

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    groupName,
    checkGroupNameAvailable,
    [workspace.id],
    open
  );

  const [state, formAction, isPending] = useActionState(updateGroupAction, {
    ok: false,
  } satisfies FormActionState);

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (open) {
      setStatus(workspace.status);
      setGroupName(workspace.name);
      setRegion(workspace.region ?? "");
      setAccountDirectorId(workspace.account_director?.id ?? "");
    }
  }, [open, workspace]);

  const directorOptions = accountDirectors.map((d) => ({
    value: d.id,
    label: d.full_name?.trim() || d.email,
  }));

  const regionOptions = GROUP_REGION_OPTIONS.map((r) => ({
    value: r.value,
    label: r.label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit group</SheetTitle>
          <SheetDescription>
            Update operational profile for {workspace.name}.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <input type="hidden" name="group_id" value={workspace.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="region" value={region} />
          <input type="hidden" name="account_director_id" value={accountDirectorId} />

          <EntityLogoField
            kind="group"
            entityId={workspace.id}
            logoUrl={workspace.logo_url}
            label="Group logo"
            hint="Shown to the left of the Thinkway logo in Client Workspace. PNG, JPG, or WebP · up to 2 MB."
            disabled={isPending}
          />

          <div className="grid gap-2">
            <Label htmlFor="group_name">Group name</Label>
            <Input
              id="group_name"
              name="name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
            {duplicateMessage ? (
              <p className="text-xs text-destructive">{duplicateMessage}</p>
            ) : checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Region</Label>
              <SearchableSelect
                value={region}
                onValueChange={setRegion}
                options={regionOptions}
                placeholder="Select region"
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ClientStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Account director</Label>
            <SearchableSelect
              value={accountDirectorId}
              onValueChange={setAccountDirectorId}
              options={directorOptions}
              placeholder="Assign account director"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group_notes">Notes</Label>
            <Textarea
              id="group_notes"
              name="notes"
              rows={3}
              defaultValue={workspace.notes ?? ""}
              disabled={isPending}
            />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending || isDuplicate || checking}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
