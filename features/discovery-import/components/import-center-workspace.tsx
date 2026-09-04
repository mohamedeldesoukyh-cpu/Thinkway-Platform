"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DiscoveryListCard,
  DiscoverySectionHeader,
  DiscoverySuiteMasthead,
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

  const needsPolling = useMemo(
    () => creatorImportFilesNeedPolling(files),
    [files],
  );
  const metrics = useMemo(
    () => [
      { label: "Uploads", value: files.length },
      {
        label: "Creators",
        value: files.reduce((sum, file) => sum + file.total_creators, 0),
      },
      {
        label: "Imported",
        value: files.reduce((sum, file) => sum + file.imported_creators, 0),
        tone: "g" as const,
      },
      {
        label: "Updated",
        value: files.reduce((sum, file) => sum + file.updated_creators, 0),
      },
      {
        label: "Failed",
        value: files.reduce((sum, file) => sum + file.failed_creators, 0),
        tone: "r" as const,
      },
    ],
    [files],
  );

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
    <div className="discovery-suite space-y-4 bg-[var(--tw-bg)] p-4">
      <DiscoverySuiteMasthead
        title="Import center"
        metrics={metrics}
        freezeOnScroll={false}
      />
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
