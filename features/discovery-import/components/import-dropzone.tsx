"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { uploadCreatorImportFileAction } from "@/features/discovery-import/actions";
import { CREATOR_IMPORT_UPLOAD_CONCURRENCY } from "@/lib/discovery-import/constants";
import type { CreatorImportUploadProgressItem } from "@/features/discovery-import/types";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "application/csv": [".csv"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

type ImportDropzoneProps = {
  onUploadComplete?: () => void | Promise<void>;
};

function resolveProgressStatusText(item: CreatorImportUploadProgressItem): string {
  if (item.status === "uploading") return "Uploading…";
  if (item.status === "pending") return "Waiting…";
  if (item.status === "success") {
    return item.message ?? "File uploaded. Queued for processing.";
  }
  return item.message ?? "Upload failed";
}

export function ImportDropzone({ onUploadComplete }: ImportDropzoneProps) {
  const [sourceName, setSourceName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<CreatorImportUploadProgressItem[]>([]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsUploading(true);
      setProgress(
        files.map((file) => ({
          filename: file.name,
          status: "pending",
        }))
      );

      let successCount = 0;
      let nextIndex = 0;

      const uploadOne = async (file: File, index: number) => {
        setProgress((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "uploading" } : item
          )
        );

        const formData = new FormData();
        formData.set("file", file);
        if (sourceName.trim()) {
          formData.set("source_name", sourceName.trim());
        }

        const result = await uploadCreatorImportFileAction(formData);

        if (result.ok) {
          successCount += 1;
          setProgress((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, status: "success", message: result.message }
                : item
            )
          );
        } else {
          setProgress((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? { ...item, status: "error", message: result.message }
                : item
            )
          );
          toast.error(result.message ?? `Failed to upload ${file.name}`);
        }
      };

      const worker = async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= files.length) break;
          await uploadOne(files[index], index);
        }
      };

      const workerCount = Math.min(CREATOR_IMPORT_UPLOAD_CONCURRENCY, files.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      setIsUploading(false);

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 file uploaded successfully."
            : `${successCount} files uploaded successfully.`
        );
        await onUploadComplete?.();
      }
    },
    [onUploadComplete, sourceName]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      void uploadFiles(acceptedFiles);
    },
    accept: ACCEPT,
    multiple: true,
    disabled: isUploading,
    noClick: true,
    noKeyboard: true,
  });

  const completedCount = progress.filter((item) => item.status === "success").length;
  const errorCount = progress.filter((item) => item.status === "error").length;
  const uploadingCount = progress.filter((item) => item.status === "uploading").length;
  const overallPercent =
    progress.length === 0
      ? 0
      : Math.round(
          ((completedCount + errorCount + uploadingCount * 0.5) / progress.length) * 100
        );

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 220px",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div
          {...getRootProps()}
          className={cn(
            "tw-drop",
            isDragActive && "ring-2 ring-[var(--tw-blue)]",
            isUploading && "pointer-events-none opacity-70"
          )}
        >
          <input {...getInputProps()} />
          <span className="ic" aria-hidden>
            {isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              "↑"
            )}
          </span>
          <b>
            {isDragActive
              ? "Drop files to upload"
              : "Drag and drop creator datasets"}
          </b>
          <p>
            .PDF · .XLSX · .CSV · .ZIP — ZIP bundles may contain CSV or XLSX plus
            optional avatar images. Multiple files, up to 50 MB each.
          </p>
          <button
            type="button"
            className="tw-b pri"
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            disabled={isUploading}
          >
            <FileIcon className="mr-1 inline size-3.5" />
            Browse files
          </button>
        </div>

        <div>
          <label className="tw-lbl" htmlFor="source_name">
            Source name (optional)
          </label>
          <input
            id="source_name"
            className="tw-in"
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="e.g. Ogilvy, TikTok"
            aria-label="Source name"
            disabled={isUploading}
          />
          <div className="tw-hint">
            Tag uploads with the dataset provider so history can be filtered
            later. One of the five below is untagged.
          </div>
        </div>
      </div>

      {progress.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--tw-line)] bg-background">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs font-semibold text-foreground">
              Upload progress
            </span>
            <span className="text-xs font-bold text-[var(--tw-blue)]">
              {overallPercent}%
            </span>
          </div>
          <div className="h-1 bg-[var(--tw-hair)]">
            <div
              className="relative h-full overflow-hidden bg-[var(--tw-blue)] transition-[width] duration-500 ease-out"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <ul className="divide-y divide-[var(--tw-line)]">
            {progress.map((item) => (
              <li
                key={item.filename}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="truncate text-xs font-medium text-[var(--tw-mut)]">
                  {item.filename}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] font-semibold",
                    item.status === "success" && "text-[var(--tw-ok)]",
                    item.status === "error" && "text-[var(--tw-bad)]",
                    item.status === "uploading" && "text-[var(--tw-blue)]",
                    item.status === "pending" && "text-[var(--tw-mut)]"
                  )}
                >
                  {resolveProgressStatusText(item)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
