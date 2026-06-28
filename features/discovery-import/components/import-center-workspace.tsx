"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ImportDropzone } from "@/features/discovery-import/components/import-dropzone";
import { ImportHistoryTable } from "@/features/discovery-import/components/import-history-table";
import { ResetDemoCreatorsButton } from "@/features/discovery-import/components/reset-demo-creators-button";
import {
  CREATOR_IMPORT_POLL_INTERVAL_MS,
  creatorImportFilesNeedPolling,
} from "@/features/discovery-import/import-status";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";

type ImportCenterWorkspaceProps = {
  initialFiles: CreatorImportFileRow[];
  demoResetEnabled: boolean;
};

export function ImportCenterWorkspace({
  initialFiles,
  demoResetEnabled,
}: ImportCenterWorkspaceProps) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);

  const refreshFiles = useCallback(async () => {
    const res = await fetch("/api/discovery/import/files");
    if (!res.ok) return;
    const data = (await res.json()) as { files: CreatorImportFileRow[] };
    setFiles(data.files);
  }, []);

  const handleUploadComplete = useCallback(async () => {
    await refreshFiles();
    router.refresh();
  }, [refreshFiles, router]);

  const needsPolling = useMemo(() => creatorImportFilesNeedPolling(files), [files]);

  useEffect(() => {
    if (!needsPolling) return;

    const timer = window.setInterval(() => {
      void refreshFiles();
    }, CREATOR_IMPORT_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [needsPolling, refreshFiles]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Upload datasets</h3>
          <p className="text-xs text-muted-foreground">
            Uploads are processed automatically; source files are removed after import
            completes. Filename and row counts stay in upload history.
          </p>
        </div>
        <ImportDropzone onUploadComplete={handleUploadComplete} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Upload history</h3>
            <p className="text-xs text-muted-foreground">
              Track uploaded files and processing outcomes.
            </p>
          </div>
          <ResetDemoCreatorsButton enabled={demoResetEnabled} />
        </div>
        <ImportHistoryTable files={files} />
      </section>
    </div>
  );
}
