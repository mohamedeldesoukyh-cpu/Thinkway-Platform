"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DiscoveryListCard,
  DiscoverySectionHeader,
  DiscoverySuiteMasthead,
} from "@/features/discovery/components/design-system";
import { ImportDropzone } from "@/features/discovery-import/components/import-dropzone";
import {
  ImportHistoryTable,
  sumImportHistoryTotals,
} from "@/features/discovery-import/components/import-history-table";
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

const FILE_DELETION_WARNING =
  "Uploads process automatically and source files are removed after import — only the filename and row counts stay in history. Download the original before uploading if you need it.";

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
    [files]
  );

  const totals = useMemo(() => sumImportHistoryTotals(files), [files]);

  const metrics = useMemo(
    () => [
      { label: "Uploads", value: files.length },
      { label: "Creators", value: totals.creators },
      { label: "Imported", value: totals.imported, tone: "g" as const },
      { label: "Updated", value: totals.updated },
      { label: "Failed", value: totals.failed, tone: "r" as const },
      {
        label: "Processing",
        value: totals.processing,
        tone: totals.processing > 0 ? ("y" as const) : undefined,
      },
    ],
    [files.length, totals]
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
        subtitle="Upload creator datasets from agencies, platforms, or clients."
        metrics={metrics}
        freezeOnScroll={false}
      />

      {/* Destructive + irreversible — above grid, before the user drops anything. */}
      <p className="tw-note wrn">{FILE_DELETION_WARNING}</p>

      <DiscoveryListCard>
        <DiscoverySectionHeader
          title="Upload datasets"
          description="from agencies, platforms or clients"
        />
        <div className="tw-pad">
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
