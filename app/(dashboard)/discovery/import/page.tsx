import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ImportCenterWorkspace } from "@/features/discovery-import/components/import-center-workspace";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { getCreatorImportFiles } from "@/features/discovery-import/queries";
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
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {errorMessage ? (
              <div className="mb-4 rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            <ImportCenterWorkspace initialFiles={files} />
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
