import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientProfile } from "@/features/clients/components/client-profile";
import { getClientById } from "@/features/clients/queries";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const { id } = await params;

  let client;
  let errorMessage: string | null = null;

  try {
    client = await getClientById(id);
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
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : client ? (
        <ClientProfile client={client} />
      ) : null}
    </DashboardShell>
  );
}
