import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { EmailSettingsSection } from "@/features/settings/components/email-settings-section";

export default function SettingsEmailPage() {
  return (
    <DashboardShell
      title="Email"
      description="Configure Thinkway outbound email for Client IO delivery."
    >
      <PlatformErrorBoundary surface="generic">
        <EmailSettingsSection />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
