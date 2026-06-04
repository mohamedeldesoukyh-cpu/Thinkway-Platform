"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClientAccessRoleAction } from "@/features/client-access/actions";
import { CLIENT_ACCESS_ROLES } from "@/features/client-access/constants";
import type { ClientAccessRole } from "@/features/client-access/types";

const INITIAL = { ok: false } as const;

type Props = {
  clientId: string;
  profileId: string;
  currentRole: ClientAccessRole;
};

export function ClientAccessRoleSelect({ clientId, profileId, currentRole }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState(currentRole);
  const [state, action, pending] = useActionState(updateClientAccessRoleAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="access_role" value={role} />
      <Select
        value={role}
        onValueChange={(value) => {
          setRole(value as ClientAccessRole);
          requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
        disabled={pending}
      >
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIENT_ACCESS_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
