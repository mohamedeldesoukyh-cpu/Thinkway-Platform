"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DiscoveryListCard,
  DiscoverySectionHeader,
} from "@/features/discovery/components/design-system";
import { ImportDropzone } from "@/features/discovery-import/components/import-dropzone";
import { ImportHistoryTable } from "@/features/discovery-import/components/import-history-table";
import { ResetDemoCreatorsButton } from "@/features/discovery-import/components/reset-demo-creators-button";
import { notifyCreatorImportCompleted } from "@/lib/discovery-import/constants";
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
  const prevStatusesRef = useRef<Map<string, string>>(new Map());

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

  useEffect(() => {
    for (const file of files) {
      const previous = prevStatusesRef.current.get(file.id);
      if (previous && previous !== "completed" && file.status === "completed") {
        notifyCreatorImportCompleted();
      }
      prevStatusesRef.current.set(file.id, file.status);
    }
  }, [files]);

  return (
    <div className="space-y-4">
      <DiscoveryListCard>
        <DiscoverySectionHeader
          title="Upload datasets"
          description="Uploads are processed automatically; source files are removed after import completes. Filename and row counts stay in upload history."
        />
        <div className="p-4 md:p-5">
          <ImportDropzone onUploadComplete={handleUploadComplete} />
        </div>
      </DiscoveryListCard>

      <ImportHistoryTable
        files={files}
        headerAction={<ResetDemoCreatorsButton enabled={demoResetEnabled} />}
        onImportAction={refreshFiles}
      />
    </div>
  );
}
