import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PermissionsMatrix } from "@/features/settings/components/permissions-matrix";
import { getRolePermissionMatrix } from "@/features/settings/queries";

export default async function SettingsPermissionsPage() {
  const matrix = await getRolePermissionMatrix();

  return (
    <DashboardShell
      title="Permissions"
      description="Simple permissions matrix across Thinkway operational modules."
    >
      <PlatformErrorBoundary surface="ios">
        <PermissionsMatrix matrix={matrix} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
