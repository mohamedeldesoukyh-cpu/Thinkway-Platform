import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { SettingsRolesSection } from "@/features/settings/components/settings-roles-section";
import { getSettingsRoles } from "@/features/settings/queries";

export default async function SettingsRolesPage() {
  const roles = await getSettingsRoles();

  return (
    <DashboardShell
      title="Roles"
      description="Operational role catalog for Thinkway internal and portal users."
    >
      <PlatformErrorBoundary surface="ios">
        <SettingsRolesSection roles={roles} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
