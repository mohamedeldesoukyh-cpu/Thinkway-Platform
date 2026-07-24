import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { MfaSecuritySection } from "@/features/settings/components/mfa-security-section";
import { roleRequiresMfa } from "@/lib/auth/mfa-policy";
import { requireRequestUser } from "@/lib/supabase/server";

export default async function SettingsSecurityPage() {
  const { roleSlug } = await requireRequestUser();
  const mfaRequired = roleRequiresMfa(roleSlug);

  return (
    <DashboardShell
      title="Security"
      description="Multi-factor authentication and privileged-session controls."
    >
      <PlatformErrorBoundary surface="ios">
        <MfaSecuritySection mfaRequired={mfaRequired} roleSlug={roleSlug} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
