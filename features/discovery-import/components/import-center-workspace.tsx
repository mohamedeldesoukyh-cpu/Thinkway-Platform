"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ImportDropzone } from "@/features/discovery-import/components/import-dropzone";
import { ImportHistoryTable } from "@/features/discovery-import/components/import-history-table";
import {
  CREATOR_IMPORT_POLL_INTERVAL_MS,
  creatorImportFilesNeedPolling,
} from "@/features/discovery-import/import-status";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";

type ImportCenterWorkspaceProps = {
  initialFiles: CreatorImportFileRow[];
};

export function ImportCenterWorkspace({ initialFiles }: ImportCenterWorkspaceProps) {
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
      <section className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Discovery Import Center
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Upload creator datasets from agencies, platforms, or clients.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Upload datasets</h3>
          <p className="text-xs text-muted-foreground">
            Files are stored securely and queued for processing in a later phase.
          </p>
        </div>
        <ImportDropzone onUploadComplete={handleUploadComplete} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Upload history</h3>
          <p className="text-xs text-muted-foreground">
            Track uploaded files and processing outcomes.
          </p>
        </div>
        <ImportHistoryTable files={files} />
      </section>
    </div>
  );
}
