import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
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
    <DiscoveryPageShell page="import">
      {errorMessage ? (
        <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      <ImportCenterWorkspace
        initialFiles={files}
        demoResetEnabled={isDemoResetEnabled()}
      />
    </DiscoveryPageShell>
  );
}
