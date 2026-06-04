import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteUserSheet } from "@/features/settings/components/invite-user-sheet";
import { UsersTable } from "@/features/settings/components/users-table";
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
        <Card>
          <CardHeader>
            <CardTitle>User management</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersTable users={users} roles={roles} />
          </CardContent>
        </Card>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
