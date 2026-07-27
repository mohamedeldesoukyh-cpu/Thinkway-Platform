import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AppVersion } from "@/components/version/app-version";
import { getReleaseInfo } from "@/lib/release/release-info";

export const metadata = {
  title: "About",
};

export default function SettingsAboutPage() {
  const info = getReleaseInfo();

  return (
    <DashboardShell
      title="About"
      description="Thinkway Platform release and deployment details."
    >
      <div className="mx-auto max-w-lg space-y-4">
        <AppVersion variant="panel" info={info} />
      </div>
    </DashboardShell>
  );
}
