import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AccessControlWorkspace } from "@/features/settings/components/access-control-workspace";
import {
  getAccessControlGuidance,
  getRolePermissionMatrix,
  getSettingsPermissions,
} from "@/features/settings/queries";

type Props = {
  searchParams: Promise<{ role?: string }>;
};

export default async function SettingsAccessControlPage({ searchParams }: Props) {
  const params = await searchParams;
  const [matrix, permissions, guidance] = await Promise.all([
    getRolePermissionMatrix(),
    getSettingsPermissions(),
    Promise.resolve(getAccessControlGuidance()),
  ]);

  return (
    <DashboardShell
      title="Access Control"
      description="Control module visibility, page access, and portal access by role."
    >
      <PlatformErrorBoundary surface="ios">
        <div className="space-y-4">
          <AccessControlWorkspace
            matrix={matrix}
            permissions={permissions}
            selectedRoleId={params.role ?? null}
          />
          <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Operational guardrails</p>
            <ul className="list-disc pl-5 space-y-1">
              {guidance.hardRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
