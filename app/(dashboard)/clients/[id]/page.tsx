import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  getAssignableClientProfiles,
  getClientAccessForEntity,
} from "@/features/client-access/queries";
import { ClientProfile } from "@/features/clients/components/client-profile";
import {
  getClientOnboardingPermissions,
  getClientOnboardingTimeline,
} from "@/features/clients/onboarding-queries";
import { getClientById } from "@/features/clients/queries";
import { getClientIoSendRecipients, getClientIosForClient } from "@/features/io/queries";
import { getGroupsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";
import { tryCompleteFinanceOnboarding } from "@/lib/clients/try-complete-finance-onboarding";
import { requireRequestUser } from "@/lib/supabase/server";
import { clientDetailPath } from "@/lib/routing/entity-paths";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchClientRouteSummary,
  resolveClientIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<ClientProfilePageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const clientId = await resolveClientIdByRouteKey(routeKey);
  if (!clientId) return { title: "Legal entity" };

  const summary = await fetchClientRouteSummary(clientId);
  if (!summary) return { title: "Legal entity" };

  return {
    title: metadataTitleForEntity(summary, summary.document_number),
  };
}

export default async function ClientProfilePage({
  params,
  searchParams,
}: ClientProfilePageProps) {
  const { id: routeKey } = await params;
  const { tab } = await searchParams;

  const clientId = await resolveClientIdByRouteKey(routeKey);
  if (!clientId) notFound();

  const routeSummary = await fetchClientRouteSummary(clientId);
  if (routeSummary) {
    redirectToCanonicalEntityRoute({
      routeKey,
      entity: routeSummary,
      canonicalPath: clientDetailPath(routeSummary),
    });
  }

  let client;
  let groups: Awaited<ReturnType<typeof getGroupsForSelect>> = [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let clientIos: Awaited<ReturnType<typeof getClientIosForClient>> = [];
  let clientIoRecipients: Awaited<ReturnType<typeof getClientIoSendRecipients>> = [];
  let clientAccessEntity: Awaited<ReturnType<typeof getClientAccessForEntity>> = null;
  let assignableClientProfiles: Awaited<
    ReturnType<typeof getAssignableClientProfiles>
  > = [];
  let onboardingTimeline: Awaited<ReturnType<typeof getClientOnboardingTimeline>> = [];
  let onboardingPermissions: Awaited<ReturnType<typeof getClientOnboardingPermissions>> = {
    canEditChecklist: false,
    canOverrideStatus: false,
  };
  let errorMessage: string | null = null;

  try {
    client = await getClientById(clientId);
    if (
      client?.onboarding_status === "finance_pending" &&
      !(client.credit_limit_active ?? false) &&
      client.legal_completed_at
    ) {
      try {
        const { supabase, user } = await requireRequestUser();
        const reconciled = await tryCompleteFinanceOnboarding({
          supabase,
          clientId,
          userId: user.id,
        });
        if (reconciled.completed) {
          client = await getClientById(clientId);
        }
      } catch {
        // Unauthenticated or reconcile skipped — profile still renders with derived badge.
      }
    }
    [
      groups,
      masterData,
      clientIos,
      clientIoRecipients,
      clientAccessEntity,
      assignableClientProfiles,
      onboardingTimeline,
      onboardingPermissions,
    ] = await Promise.all([
      getGroupsForSelect(),
      getMasterDataOptions(),
      getClientIosForClient(clientId),
      getClientIoSendRecipients(clientId),
      getClientAccessForEntity(clientId),
      getAssignableClientProfiles(clientId),
      getClientOnboardingTimeline(clientId),
      getClientOnboardingPermissions(),
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
      title={client?.name ?? "Client profile"}
      hidePageHeader
      platformV6
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
          onboardingTimeline={onboardingTimeline}
          canEditOnboardingChecklist={onboardingPermissions.canEditChecklist}
          canOverrideOnboardingStatus={onboardingPermissions.canOverrideStatus}
          defaultTab={tab}
        />
      ) : null}
    </DashboardShell>
  );
}
