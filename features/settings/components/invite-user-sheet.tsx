"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIENT_ACCESS_ROLES } from "@/features/client-access/constants";
import { inviteUserAction } from "@/features/settings/actions";
import { BUSINESS_FUNCTION_OPTIONS } from "@/features/settings/constants";
import type { SettingsRoleRow } from "@/features/settings/types";

const INITIAL = { ok: false } as const;

type ClientOption = { id: string; name: string; document_number: string };

export function InviteUserSheet({
  roles,
  clients = [],
}: {
  roles: SettingsRoleRow[];
  clients?: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [portalType, setPortalType] = useState("internal");
  const [roleId, setRoleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [accessRole, setAccessRole] = useState("view");
  const [businessFunction, setBusinessFunction] = useState("unset");
  const [isPrimary, setIsPrimary] = useState(false);
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

          {portalType === "client" ? (
            <>
              <div className="grid gap-2">
                <Label>Legal entity</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select legal entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({formatDocumentNumberForDisplay(client.document_number)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="client_id" value={clientId} />
              </div>
              <div className="grid gap-2">
                <Label>Client access role</Label>
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
                <input type="hidden" name="access_role" value={accessRole} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="invite_is_primary"
                  name="is_primary"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="size-4 rounded border"
                />
                <Label htmlFor="invite_is_primary">Primary contact</Label>
              </div>
            </>
          ) : null}

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
            <Label>Function</Label>
            <Select value={businessFunction} onValueChange={setBusinessFunction}>
              <SelectTrigger>
                <SelectValue placeholder="OPS / Sales (optional)" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_FUNCTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value || "unset"} value={option.value || "unset"}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="business_function"
              value={businessFunction === "unset" ? "" : businessFunction}
            />
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
            <Button
              type="submit"
              disabled={
                pending ||
                !roleId ||
                (portalType === "client" && !clientId)
              }
            >
              {pending ? "Inviting..." : "Send invite"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
