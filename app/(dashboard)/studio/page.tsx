import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageAlert } from "@/components/ui/page-alert";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StudioCampaignPicker } from "@/features/studio/components/studio-campaign-picker-lazy";
import { listStudioPickerData } from "@/features/studio/queries/list-studio-picker-data";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const data = await listStudioPickerData();

  if ("error" in data) {
    return (
      <DashboardShell
        title="Campaign Studio"
        description="Strategy, outputs, and AI copilot for client-facing campaign work."
        platformV6
      >
        <div className="mx-auto max-w-lg px-5 py-12">
          <PageAlert>{data.error}</PageAlert>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/campaigns" className="font-medium text-[var(--tw-primary,#1D9E75)] hover:underline">
              Browse campaigns
            </Link>{" "}
            or contact your administrator for AI access.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Campaign Studio"
      description="Strategy, outputs, and AI copilot for client-facing campaign work."
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 overflow-y-auto p-0 md:p-0"
    >
      <PlatformErrorBoundary surface="analytics">
        <StudioCampaignPicker conversations={data.conversations} campaigns={data.campaigns} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
