"use client";

import { UsersIcon } from "lucide-react";

import { ClientFormSection } from "@/features/clients/components/client-form-ui";
import { ClientAccessWorkspace } from "@/features/client-access/components/client-access-workspace";
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";

type Props = {
  entity: ClientAccessEntityRow | null;
  assignable: AssignableClientProfileRow[];
};

export function ClientAccessTab({ entity, assignable }: Props) {
  if (!entity) {
    return (
      <p className="text-[13px] text-[#9099A8]">Legal entity not found.</p>
    );
  }

  return (
    <ClientFormSection
      icon={UsersIcon}
      title="Client portal access"
      description="Assign users who can sign in to the client portal for this legal entity."
    >
      <ClientAccessWorkspace entity={entity} assignable={assignable} compact />
    </ClientFormSection>
  );
}
