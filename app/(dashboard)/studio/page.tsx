import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageAlert } from "@/components/ui/page-alert";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StudioCampaignPicker } from "@/features/studio/components/studio-campaign-picker-lazy";
import { listStudioPickerData } from "@/features/studio/queries/list-studio-picker-data";

export const dynamic = "force-dynamic";

type StudioPageProps = {
  searchParams: Promise<{ start?: string; new?: string }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams;
  const data = await listStudioPickerData();
  const initialStart = params.start ?? (params.new ? "new" : null);

  if ("error" in data) {
    return (
      <DashboardShell
        title="Campaign Studio"
        description="Plan campaigns from a brief, history, or a live campaign."
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
      description="Plan campaigns from a brief, history, or a live campaign."
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 overflow-y-auto p-0 md:p-0"
    >
      <PlatformErrorBoundary surface="analytics">
        <StudioCampaignPicker
          history={data.history}
          campaigns={data.campaigns}
          initialStart={initialStart}
        />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
