"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteUserAction } from "@/features/settings/actions";
import type { SettingsRoleRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

export function InviteUserSheet({ roles }: { roles: SettingsRoleRow[] }) {
  const [open, setOpen] = useState(false);
  const [portalType, setPortalType] = useState("internal");
  const [roleId, setRoleId] = useState("");
  const [state, action, pending] = useActionState(inviteUserAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>Invite user</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite user</SheetTitle>
        </SheetHeader>
        <form action={action} className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Name</Label>
            <Input id="full_name" name="full_name" placeholder="Full name" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div className="grid gap-2">
            <Label>Portal type</Label>
            <Select value={portalType} onValueChange={setPortalType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="portal_type" value={portalType} />
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="role_id" value={roleId} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" placeholder="Finance / Operations / etc." />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="country_code">Country</Label>
            <Input id="country_code" name="country_code" placeholder="EG / AE / SA..." maxLength={2} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !roleId}>
              {pending ? "Inviting..." : "Send invite"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
