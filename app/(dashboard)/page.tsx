import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HomePage } from "@/features/home/components/home-page";
import { getHomeDashboardSnapshot } from "@/features/home/queries";

export default async function DashboardPage() {
  let snapshot = null;
  let bannerError: string | null = null;

  try {
    snapshot = await getHomeDashboardSnapshot();
  } catch (error) {
    bannerError =
      error instanceof Error ? error.message : "Failed to load your dashboard summary.";
  }

  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
      platformV6
      hidePageHeader
      immersiveLayout
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      {snapshot ? (
        <HomePage snapshot={snapshot} />
      ) : bannerError ? (
        <div className="m-5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {bannerError}
        </div>
      ) : null}
    </DashboardShell>
  );
}
