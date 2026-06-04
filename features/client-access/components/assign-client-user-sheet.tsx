"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { assignClientUserAction } from "@/features/client-access/actions";
import { CLIENT_ACCESS_ROLES } from "@/features/client-access/constants";
import type { AssignableClientProfileRow } from "@/features/client-access/types";

const INITIAL = { ok: false } as const;

type Props = {
  clientId: string;
  clientName: string;
  assignable: AssignableClientProfileRow[];
};

export function AssignClientUserSheet({ clientId, clientName, assignable }: Props) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [accessRole, setAccessRole] = useState("view");
  const [isPrimary, setIsPrimary] = useState(false);
  const [state, action, pending] = useActionState(assignClientUserAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      setProfileId("");
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" disabled={assignable.length === 0}>
          Assign user
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Assign client user</SheetTitle>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </SheetHeader>
        <form action={action} className="mt-4 grid gap-4">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="access_role" value={accessRole} />
          {isPrimary ? <input type="hidden" name="is_primary" value="on" /> : null}

          <div className="grid gap-2">
            <Label>User</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client portal user" />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={accessRole} onValueChange={setAccessRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ACCESS_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 rounded border"
            />
            <Label htmlFor="is_primary">Primary contact</Label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !profileId}>
              {pending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
