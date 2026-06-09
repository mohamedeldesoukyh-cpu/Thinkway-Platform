import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { InviteUserSheet } from "@/features/settings/components/invite-user-sheet";
import { SettingsUsersSection } from "@/features/settings/components/settings-users-section";
import { getClientsForAccessSelect } from "@/features/client-access/queries";
import { getSettingsRoles, getSettingsUsers } from "@/features/settings/queries";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; role?: string }>;
};

export default async function SettingsUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const [roles, users, clients] = await Promise.all([
    getSettingsRoles(),
    getSettingsUsers({ q: params.q, status: params.status, role: params.role }),
    getClientsForAccessSelect(),
  ]);

  return (
    <DashboardShell
      title="Users"
      description="Centralized operational user access management for Thinkway."
      actions={<InviteUserSheet roles={roles} clients={clients} />}
    >
      <PlatformErrorBoundary surface="ios">
        <SettingsUsersSection users={users} roles={roles} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
