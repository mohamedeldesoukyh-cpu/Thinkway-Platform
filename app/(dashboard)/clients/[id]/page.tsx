import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  getAssignableClientProfiles,
  getClientAccessForEntity,
} from "@/features/client-access/queries";
import { ClientProfile } from "@/features/clients/components/client-profile";
import { getClientById } from "@/features/clients/queries";
import { getClientIoSendRecipients, getClientIosForClient } from "@/features/io/queries";
import { getGroupsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const { id } = await params;

  let client;
  let groups: Awaited<ReturnType<typeof getGroupsForSelect>> = [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let clientIos: Awaited<ReturnType<typeof getClientIosForClient>> = [];
  let clientIoRecipients: Awaited<ReturnType<typeof getClientIoSendRecipients>> = [];
  let clientAccessEntity: Awaited<ReturnType<typeof getClientAccessForEntity>> = null;
  let assignableClientProfiles: Awaited<
    ReturnType<typeof getAssignableClientProfiles>
  > = [];
  let errorMessage: string | null = null;

  try {
    client = await getClientById(id);
    [
      groups,
      masterData,
      clientIos,
      clientIoRecipients,
      clientAccessEntity,
      assignableClientProfiles,
    ] = await Promise.all([
      getGroupsForSelect(),
      getMasterDataOptions(),
      getClientIosForClient(id),
      getClientIoSendRecipients(id),
      getClientAccessForEntity(id),
      getAssignableClientProfiles(id),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load client.";
  }

  if (!client && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Client profile"
      description="Master data, compliance documents, finance terms, and campaign history."
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : client && masterData ? (
        <ClientProfile
          client={client}
          groups={groups}
          masterData={masterData}
          clientIos={clientIos}
          clientIoRecipients={clientIoRecipients}
          clientAccessEntity={clientAccessEntity}
          assignableClientProfiles={assignableClientProfiles}
        />
      ) : null}
    </DashboardShell>
  );
}
