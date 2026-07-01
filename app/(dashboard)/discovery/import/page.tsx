import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { ImportCenterHero } from "@/features/discovery-import/components/import-center-hero";
import { ImportCenterWorkspace } from "@/features/discovery-import/components/import-center-workspace";
import { getCreatorImportFiles } from "@/features/discovery-import/queries";
import { isDemoResetEnabled } from "@/lib/discovery-import/demo-reset-policy";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";

export default async function DiscoveryImportPage() {
  let files: CreatorImportFileRow[] = [];
  let errorMessage: string | null = null;

  try {
    files = await getCreatorImportFiles();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load import history.";
  }

  return (
    <DashboardShell
      title="Discovery Import Center"
      description="Upload creator datasets from agencies, platforms, or clients."
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/import" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ImportCenterHero />
            <div className="px-6 py-6 md:px-7">
              <div className="mx-auto max-w-[1100px]">
                {errorMessage ? (
                  <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {errorMessage}
                  </div>
                ) : null}
                <ImportCenterWorkspace
                  initialFiles={files}
                  demoResetEnabled={isDemoResetEnabled()}
                />
              </div>
            </div>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
