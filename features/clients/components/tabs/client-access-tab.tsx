import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Client portal access</CardTitle>
      </CardHeader>
      <CardContent>
        <ClientAccessWorkspace entity={entity} assignable={assignable} compact />
      </CardContent>
    </Card>
  );
}
