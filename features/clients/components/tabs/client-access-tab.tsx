import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
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
      <p className="text-sm text-muted-foreground">Legal entity not found.</p>
    );
  }

  return (
    <CampaignFlatSection title="Client portal access">
      <ClientAccessWorkspace entity={entity} assignable={assignable} compact />
    </CampaignFlatSection>
  );
}
