import { UsersIcon } from "lucide-react";

import { ClientFormSection } from "@/features/clients/components/client-form-ui";
import { ClientAccessWorkspace } from "@/features/client-access/components/client-access-workspace";
import {
  getAssignableClientProfiles,
  getClientAccessForEntity,
} from "@/features/client-access/queries";

type Props = {
  clientId: string;
};

export async function ClientAccessTab({ clientId }: Props) {
  const [entity, assignable] = await Promise.all([
    getClientAccessForEntity(clientId),
    getAssignableClientProfiles(clientId),
  ]);

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
