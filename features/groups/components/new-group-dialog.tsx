"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  createGroupAction,
  type CreateGroupFormState,
} from "@/features/groups/actions";
import { checkGroupNameAvailable } from "@/features/validation/actions";
import type { ClientStatus } from "@/types/database";

export function NewGroupDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientStatus>("active");
  const [groupName, setGroupName] = useState("");
  const [state, formAction, isPending] = useActionState(createGroupAction, {
    ok: false,
  } satisfies CreateGroupFormState);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    groupName,
    checkGroupNameAvailable,
    [],
    open
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      setGroupName("");
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Top-level client holding company or group account.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value={status} />
          <div className="grid gap-2">
            <Label htmlFor="name">Group name</Label>
            <Input
              id="name"
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
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} disabled={isPending} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || isDuplicate || checking}>
              {isPending ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
