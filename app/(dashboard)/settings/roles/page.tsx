import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RolesTable } from "@/features/settings/components/roles-table";
import { getSettingsRoles } from "@/features/settings/queries";

export default async function SettingsRolesPage() {
  const roles = await getSettingsRoles();

  return (
    <DashboardShell
      title="Roles"
      description="Operational role catalog for Thinkway internal and portal users."
    >
      <PlatformErrorBoundary surface="ios">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <RolesTable roles={roles} />
          </CardContent>
        </Card>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
